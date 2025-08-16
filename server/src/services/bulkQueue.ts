// Bulk Queue Engine for WhatsApp Messages
// Handles batching, sequential processing, and concurrency control
import { randomUUID } from 'crypto';
import { sendWhatsAppMessage, WhatsAppMessage, WhatsAppTemplate, SendResult, BulkMessageVariables } from './waSender';
import { logger } from '../utils/logger';
import pool from '../db';

export type BulkMessage = WhatsAppMessage | WhatsAppTemplate;

export interface BulkJobInput {
  userId: string;
  campaignId?: string | null;
  recipients: string[];
  message: BulkMessage;
  variables?: BulkMessageVariables; // Static variables for quick send
  recipientVariables?: Array<{ recipient: string; variables: BulkMessageVariables }>; // Per-recipient variables for customize
}

export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface BulkJob {
  jobId: string;
  userId: string;
  campaignId?: string | null;
  totalRecipients: number;
  batchSize: number;
  totalBatches: number;
  createdAt: string;
  state: JobState;
  sent: number;
  failed: number;
  results: Array<{ to: string; ok: boolean; messageId?: string | null; error?: any }>;
}

export interface TenantCreds {
  phoneNumberId: string;
  accessToken: string;
}

export interface CredsProvider {
  getCredsByUserId(userId: string): Promise<TenantCreds>;
}

export interface CampaignLogsRepo {
  upsertOnSendAck(userId: string, messageId: string, to: string, campaignId?: string | null, meta?: any): Promise<void>;
  createCampaignLogEntry(userId: string, to: string, campaignId: string, templateName: string, phoneNumberId: string, language: string, variables?: any, components?: any): Promise<string>;
  updateCampaignLogStatus(logId: string, status: 'sent' | 'failed', messageId?: string, errorMessage?: string): Promise<void>;
}

export type SSEEmitter = (jobId: string, payload: any) => void;

// Utility functions
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class BulkQueue {
  private jobs = new Map<string, BulkJob>();

  constructor(
    private creds: CredsProvider,
    private logs: CampaignLogsRepo,
    private emitSSE: SSEEmitter
  ) {}

  enqueue(input: BulkJobInput): BulkJob {
    // Use loop-based processing: 200 messages per loop to reduce server load
    const LOOP_SIZE = parseInt(process.env.BULK_LOOP_SIZE || '200', 10);
    const HARD_CAP = parseInt(process.env.BULK_HARD_CAP || '50000', 10);

    // Validation
    if (!input.recipients?.length) {
      throw new Error('No recipients provided');
    }
    
    if (input.recipients.length > HARD_CAP) {
      throw new Error(`Recipients exceed hard cap of ${HARD_CAP}`);
    }

    const jobId = randomUUID();
    const totalLoops = Math.ceil(input.recipients.length / LOOP_SIZE);

    const job: BulkJob = {
      jobId,
      userId: input.userId,
      campaignId: input.campaignId || null,
      totalRecipients: input.recipients.length,
      batchSize: LOOP_SIZE, // This now represents loop size
      totalBatches: totalLoops, // This now represents total loops
      createdAt: new Date().toISOString(),
      state: 'queued',
      sent: 0,
      failed: 0,
      results: []
    };

    this.jobs.set(jobId, job);

    logger.info('[BULK] Job enqueued', {
      jobId,
      userId: input.userId,
      recipients: input.recipients.length,
      loops: totalLoops,
      loopSize: LOOP_SIZE
    });

    // Start job processing (fire-and-forget)
    this.processJob(jobId, input).catch(error => {
      const currentJob = this.jobs.get(jobId);
      if (currentJob) {
        currentJob.state = 'failed';
        this.emitSSE(jobId, {
          type: 'job_completed',
          jobId,
          state: currentJob.state,
          sent: currentJob.sent,
          failed: currentJob.failed,
          error: String(error)
        });
      }
      logger.error('[BULK] Job crashed', { jobId, error });
    });

    return job;
  }

  getJob(jobId: string): BulkJob | null {
    return this.jobs.get(jobId) || null;
  }

  private async processJob(jobId: string, input: BulkJobInput): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.state = 'running';
      logger.info('[BULK] Job started', { jobId, userId: input.userId });

      // Get user credentials
      const { phoneNumberId, accessToken } = await this.creds.getCredsByUserId(input.userId);

      // Split recipients into loops of 200 messages each
      const loops = chunk(input.recipients, job.batchSize); // job.batchSize now represents loop size
      
      // Loop processing settings
      const LOOP_PAUSE_MS = parseInt(process.env.BULK_LOOP_PAUSE_MS || '2000', 10); // 2 seconds between loops
      const MESSAGES_PER_SECOND = parseInt(process.env.BULK_MESSAGES_PER_SECOND || '10', 10); // Rate limiting within loop

      // Process loops sequentially to reduce server load
      for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
        const loopRecipients = loops[loopIndex];
        
        logger.info('[BULK] Loop started', { 
          jobId, 
          loopIndex: loopIndex + 1, 
          totalLoops: loops.length,
          loopSize: loopRecipients.length 
        });
        
        this.emitSSE(jobId, {
          type: 'loop_started',
          jobId,
          loopIndex: loopIndex + 1,
          totalLoops: loops.length,
          loopSize: loopRecipients.length
        });

        // Process this loop of messages sequentially (one by one to reduce load)
        await this.processLoop(job, loopRecipients, {
          userId: input.userId,
          campaignId: input.campaignId || null,
          phoneNumberId,
          accessToken,
          message: input.message,
          loopIndex: loopIndex + 1,
          messagesPerSecond: MESSAGES_PER_SECOND
        }, input.variables, input.recipientVariables);

        this.emitSSE(jobId, {
          type: 'loop_completed',
          jobId,
          loopIndex: loopIndex + 1,
          totalLoops: loops.length,
          sent: job.sent,
          failed: job.failed
        });

        logger.info('[BULK] Loop completed', { 
          jobId, 
          loopIndex: loopIndex + 1,
          totalLoops: loops.length,
          sent: job.sent, 
          failed: job.failed 
        });

        // Pause between loops to reduce server load (except for the last one)
        if (loopIndex < loops.length - 1) {
          logger.info('[BULK] Pausing between loops', { 
            jobId, 
            pauseMs: LOOP_PAUSE_MS,
            nextLoop: loopIndex + 2
          });
          await sleep(LOOP_PAUSE_MS);
        }
      }

      // Job completed
      job.state = job.failed > 0 && job.sent === 0 ? 'failed' : 'completed';
      
      this.emitSSE(jobId, {
        type: 'job_completed',
        jobId,
        state: job.state,
        sent: job.sent,
        failed: job.failed
      });

      logger.info('[BULK] Job completed', {
        jobId,
        state: job.state,
        sent: job.sent,
        failed: job.failed
      });

    } catch (error) {
      logger.error('[BULK] Job processing error', { jobId, error });
      job.state = 'failed';
      
      this.emitSSE(jobId, {
        type: 'job_completed',
        jobId,
        state: job.state,
        sent: job.sent,
        failed: job.failed,
        error: String(error)
      });
    }
  }

  private async processLoop(
    job: BulkJob,
    recipients: string[],
    options: {
      userId: string;
      campaignId: string | null;
      phoneNumberId: string;
      accessToken: string;
      message: BulkMessage;
      loopIndex: number;
      messagesPerSecond: number;
    },
    staticVariables?: BulkMessageVariables,
    recipientVariables?: Array<{ recipient: string; variables: BulkMessageVariables }>
  ): Promise<void> {
    const { messagesPerSecond } = options;
    const delayBetweenMessages = Math.ceil(1000 / messagesPerSecond); // Calculate delay to achieve desired rate
    
    // Process messages sequentially within each loop to reduce server load
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Get variables for this recipient
        let variables = staticVariables;
        if (recipientVariables) {
          const recipientData = recipientVariables.find(rv => rv.recipient === recipient);
          variables = recipientData?.variables || staticVariables;
        }
        
        // Send message
        await this.sendSingleMessage(job, recipient, {
          ...options,
          batchIndex: options.loopIndex // For compatibility with existing interface
        }, variables);
        
        // Add delay between messages to control rate (except for last message in loop)
        if (i < recipients.length - 1) {
          await sleep(delayBetweenMessages);
        }
        
      } catch (error) {
        logger.error('[BULK] Message processing error', {
          jobId: job.jobId,
          recipient,
          loopIndex: options.loopIndex,
          messageIndex: i + 1,
          error
        });
      }
    }
  }

  private async sendSingleMessage(
    job: BulkJob,
    to: string,
    options: {
      userId: string;
      campaignId: string | null;
      phoneNumberId: string;
      accessToken: string;
      message: BulkMessage;
      batchIndex: number;
    },
    variables?: BulkMessageVariables
  ): Promise<void> {
    // Create campaign log entry before sending (pending status)
    let campaignLogId: string | null = null;
    let templateName = 'unknown';
    let language = 'en_US';
    
    if (options.message.kind === 'template') {
      templateName = options.message.template.name;
      language = options.message.template.language_code;
    }

    try {
      campaignLogId = await this.logs.createCampaignLogEntry(
        options.userId,
        to,
        options.campaignId || `BULK_${job.jobId}`,
        templateName,
        options.phoneNumberId,
        language,
        variables,
        options.message.kind === 'template' ? options.message.template.components : null
      );
    } catch (logError) {
      logger.warn('[BULK] Failed to create campaign log entry', {
        jobId: job.jobId,
        to,
        error: logError
      });
    }

    // Send the message
    const result = await sendWhatsAppMessage({
      accessToken: options.accessToken,
      phoneNumberId: options.phoneNumberId,
      to,
      message: options.message,
      variables
    });

    // Update campaign log status and job statistics
    if (result.ok) {
      job.sent++;
      job.results.push({
        to: result.to,
        ok: true,
        messageId: result.messageId || null
      });

      // Update campaign log with success
      if (campaignLogId) {
        try {
          await this.logs.updateCampaignLogStatus(
            campaignLogId,
            'sent',
            result.messageId || undefined
          );
        } catch (logError) {
          logger.error('[BULK] Failed to update campaign log with success', {
            jobId: job.jobId,
            campaignLogId,
            messageId: result.messageId,
            to,
            error: logError
          });
        }
      }

      this.emitSSE(job.jobId, {
        type: 'message_sent',
        jobId: job.jobId,
        loopIndex: options.batchIndex, // This is actually loopIndex now
        to,
        messageId: result.messageId || null,
        sent: job.sent,
        failed: job.failed
      });

    } else {
      job.failed++;
      job.results.push({
        to: result.to,
        ok: false,
        error: result.error
      });

      // Update campaign log with failure
      if (campaignLogId) {
        try {
          const errorMessage = typeof result.error === 'object' 
            ? JSON.stringify(result.error) 
            : String(result.error || 'Unknown error');
          
          await this.logs.updateCampaignLogStatus(
            campaignLogId,
            'failed',
            undefined,
            errorMessage
          );
        } catch (logError) {
          logger.error('[BULK] Failed to update campaign log with failure', {
            jobId: job.jobId,
            campaignLogId,
            to,
            error: logError
          });
        }
      }

      this.emitSSE(job.jobId, {
        type: 'message_failed',
        jobId: job.jobId,
        loopIndex: options.batchIndex, // This is actually loopIndex now
        to,
        error: result.error,
        sent: job.sent,
        failed: job.failed
      });
    }
  }
}