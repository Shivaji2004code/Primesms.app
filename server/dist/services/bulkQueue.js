"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkQueue = void 0;
const crypto_1 = require("crypto");
const waSender_1 = require("./waSender");
const logger_1 = require("../utils/logger");
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
class BulkQueue {
    constructor(creds, logs, emitSSE) {
        this.creds = creds;
        this.logs = logs;
        this.emitSSE = emitSSE;
        this.jobs = new Map();
    }
    enqueue(input) {
        const LOOP_SIZE = parseInt(process.env.BULK_LOOP_SIZE || '200', 10);
        const HARD_CAP = parseInt(process.env.BULK_HARD_CAP || '50000', 10);
        if (!input.recipients?.length) {
            throw new Error('No recipients provided');
        }
        if (input.recipients.length > HARD_CAP) {
            throw new Error(`Recipients exceed hard cap of ${HARD_CAP}`);
        }
        const jobId = (0, crypto_1.randomUUID)();
        const totalLoops = Math.ceil(input.recipients.length / LOOP_SIZE);
        const job = {
            jobId,
            userId: input.userId,
            campaignId: input.campaignId || null,
            totalRecipients: input.recipients.length,
            batchSize: LOOP_SIZE,
            totalBatches: totalLoops,
            createdAt: new Date().toISOString(),
            state: 'queued',
            sent: 0,
            failed: 0,
            results: []
        };
        this.jobs.set(jobId, job);
        logger_1.logger.info('[BULK] Job enqueued', {
            jobId,
            userId: input.userId,
            recipients: input.recipients.length,
            loops: totalLoops,
            loopSize: LOOP_SIZE
        });
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
            logger_1.logger.error('[BULK] Job crashed', { jobId, error });
        });
        return job;
    }
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }
    async processJob(jobId, input) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        try {
            job.state = 'running';
            logger_1.logger.info('[BULK] Job started', { jobId, userId: input.userId });
            const { phoneNumberId, accessToken } = await this.creds.getCredsByUserId(input.userId);
            const loops = chunk(input.recipients, job.batchSize);
            const LOOP_PAUSE_MS = parseInt(process.env.BULK_LOOP_PAUSE_MS || '2000', 10);
            const MESSAGES_PER_SECOND = parseInt(process.env.BULK_MESSAGES_PER_SECOND || '10', 10);
            for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
                const loopRecipients = loops[loopIndex];
                logger_1.logger.info('[BULK] Loop started', {
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
                logger_1.logger.info('[BULK] Loop completed', {
                    jobId,
                    loopIndex: loopIndex + 1,
                    totalLoops: loops.length,
                    sent: job.sent,
                    failed: job.failed
                });
                if (loopIndex < loops.length - 1) {
                    logger_1.logger.info('[BULK] Pausing between loops', {
                        jobId,
                        pauseMs: LOOP_PAUSE_MS,
                        nextLoop: loopIndex + 2
                    });
                    await sleep(LOOP_PAUSE_MS);
                }
            }
            job.state = job.failed > 0 && job.sent === 0 ? 'failed' : 'completed';
            this.emitSSE(jobId, {
                type: 'job_completed',
                jobId,
                state: job.state,
                sent: job.sent,
                failed: job.failed
            });
            logger_1.logger.info('[BULK] Job completed', {
                jobId,
                state: job.state,
                sent: job.sent,
                failed: job.failed
            });
        }
        catch (error) {
            logger_1.logger.error('[BULK] Job processing error', { jobId, error });
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
    async processLoop(job, recipients, options, staticVariables, recipientVariables) {
        const { messagesPerSecond } = options;
        const delayBetweenMessages = Math.ceil(1000 / messagesPerSecond);
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            try {
                let variables = staticVariables;
                if (recipientVariables) {
                    const recipientData = recipientVariables.find(rv => rv.recipient === recipient);
                    variables = recipientData?.variables || staticVariables;
                }
                await this.sendSingleMessage(job, recipient, {
                    ...options,
                    batchIndex: options.loopIndex
                }, variables);
                if (i < recipients.length - 1) {
                    await sleep(delayBetweenMessages);
                }
            }
            catch (error) {
                logger_1.logger.error('[BULK] Message processing error', {
                    jobId: job.jobId,
                    recipient,
                    loopIndex: options.loopIndex,
                    messageIndex: i + 1,
                    error
                });
            }
        }
    }
    async sendSingleMessage(job, to, options, variables) {
        let campaignLogId = null;
        let templateName = 'unknown';
        let language = 'en_US';
        if (options.message.kind === 'template') {
            templateName = options.message.template.name;
            language = options.message.template.language_code;
        }
        try {
            campaignLogId = await this.logs.createCampaignLogEntry(options.userId, to, options.campaignId || `BULK_${job.jobId}`, templateName, options.phoneNumberId, language, variables, options.message.kind === 'template' ? options.message.template.components : null);
        }
        catch (logError) {
            logger_1.logger.warn('[BULK] Failed to create campaign log entry', {
                jobId: job.jobId,
                to,
                error: logError
            });
        }
        const result = await (0, waSender_1.sendWhatsAppMessage)({
            accessToken: options.accessToken,
            phoneNumberId: options.phoneNumberId,
            to,
            message: options.message,
            variables
        });
        if (result.ok) {
            job.sent++;
            job.results.push({
                to: result.to,
                ok: true,
                messageId: result.messageId || null
            });
            if (campaignLogId) {
                try {
                    await this.logs.updateCampaignLogStatus(campaignLogId, 'sent', result.messageId || undefined);
                }
                catch (logError) {
                    logger_1.logger.error('[BULK] Failed to update campaign log with success', {
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
                loopIndex: options.batchIndex,
                to,
                messageId: result.messageId || null,
                sent: job.sent,
                failed: job.failed
            });
        }
        else {
            job.failed++;
            job.results.push({
                to: result.to,
                ok: false,
                error: result.error
            });
            if (campaignLogId) {
                try {
                    const errorMessage = typeof result.error === 'object'
                        ? JSON.stringify(result.error)
                        : String(result.error || 'Unknown error');
                    await this.logs.updateCampaignLogStatus(campaignLogId, 'failed', undefined, errorMessage);
                }
                catch (logError) {
                    logger_1.logger.error('[BULK] Failed to update campaign log with failure', {
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
                loopIndex: options.batchIndex,
                to,
                error: result.error,
                sent: job.sent,
                failed: job.failed
            });
        }
    }
}
exports.BulkQueue = BulkQueue;
//# sourceMappingURL=bulkQueue.js.map