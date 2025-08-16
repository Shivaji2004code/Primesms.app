# Bulk Messaging Loop-Based Implementation

## 🔄 **Loop-Based Processing Architecture**

This implementation uses a **loop-based approach** to process bulk messages in chunks of 200 messages per loop, significantly reducing server load and improving reliability.

## ⚙️ **Key Features**

### 1. **Loop Processing (200 messages per loop)**
- Messages are processed in loops of 200 recipients each
- Each loop runs sequentially to minimize server load
- Configurable loop size via `BULK_LOOP_SIZE` environment variable

### 2. **Rate Limiting Within Loops**
- Controlled message sending rate within each loop
- Default: 10 messages per second (configurable via `BULK_MESSAGES_PER_SECOND`)
- Automatic delay calculation between individual messages

### 3. **Loop Pause Mechanism**
- 2-second pause between loops (configurable via `BULK_LOOP_PAUSE_MS`)
- Allows server to recover between processing cycles
- Prevents memory and CPU overload

### 4. **Enhanced Monitoring**
- Real-time SSE updates for loop progress
- Individual message status tracking
- Loop-by-loop completion reporting

## 🚀 **Environment Variables for Coolify**

Add these to your Coolify environment configuration:

```bash
# Loop-Based Processing Configuration
BULK_LOOP_SIZE=200                    # Messages per loop
BULK_LOOP_PAUSE_MS=2000              # Pause between loops (ms)
BULK_MESSAGES_PER_SECOND=10          # Rate limit within loops
BULK_MAX_RETRIES=3                   # Retry attempts per message
BULK_RETRY_BASE_MS=500               # Base retry delay
BULK_HARD_CAP=50000                  # Maximum total recipients

# Legacy Compatibility
BULK_BATCH_SIZE=200                  # Maps to loop size
BULK_CONCURRENCY=1                   # Sequential processing
BULK_PAUSE_MS=2000                   # Maps to loop pause
```

## 📊 **Performance Benefits**

### Before (Concurrent Batches):
- 50 messages per batch
- 5 concurrent workers
- High memory usage
- Potential server overload

### After (Sequential Loops):
- 200 messages per loop
- Sequential processing
- Controlled rate limiting
- Reduced server load
- Better error handling

## 🔧 **Technical Implementation**

### Loop Processing Flow:
1. **Split Recipients**: Divide total recipients into loops of 200
2. **Process Loop**: Send messages sequentially within loop
3. **Rate Control**: 100ms delay between messages (10/second)
4. **Loop Pause**: 2-second rest between loops
5. **Status Update**: Real-time progress reporting via SSE

### Database Optimization:
- Campaign logs created before sending
- Status updates after each message
- Bulk-optimized queries
- Webhook integration for read receipts

## 📱 **Frontend Integration**

The frontend automatically detects bulk operations (>50 recipients) and:
- Shows loop-based progress messages
- Displays optimized processing notifications
- Provides real-time job tracking
- Maintains backward compatibility

## 🛠 **API Endpoints**

### Bulk Quick Send:
```
POST /api/whatsapp/bulk-quick-send
```

### Bulk Customize Send:
```
POST /api/whatsapp/bulk-customize-send
```

### Job Status Tracking:
```
GET /api/bulk/job/{jobId}
```

### Real-time Updates:
```
SSE /api/bulk/realtime/{jobId}
```

## 📈 **Monitoring & Logging**

Loop progress is tracked with detailed logging:
- Loop start/completion events
- Message-level success/failure tracking
- Performance metrics per loop
- Error aggregation and reporting

## 🔄 **Webhook Integration**

Enhanced webhook processing for:
- Delivery status updates
- Read receipt tracking
- Failed message handling
- Real-time status synchronization

## 🚀 **Coolify Deployment Ready**

This implementation is fully optimized for Coolify deployment with:
- Environment variable configuration
- Docker container compatibility
- PostgreSQL integration
- Horizontal scaling support
- Health check endpoints

## 📋 **Usage Example**

```javascript
// Automatic bulk detection for 500+ recipients
const response = await fetch('/api/whatsapp/bulk-quick-send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone_number_id: 'your_phone_id',
    template_name: 'your_template',
    recipients_text: recipients.join('\n'), // 500+ numbers
    variables: { '1': 'Dynamic Value' }
  })
});

// Result: 3 loops of 200 messages each (500÷200 = 2.5 → 3 loops)
// Processing: Loop 1 (200) → Pause 2s → Loop 2 (200) → Pause 2s → Loop 3 (100)
```

This loop-based approach ensures reliable, scalable bulk messaging while maintaining optimal server performance.