"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userBusinessRepo = exports.templatesRepo = void 0;
const db_1 = __importDefault(require("../db"));
exports.templatesRepo = {
    async upsertStatusAndCategory(input) {
        const { userId, name, language, status, category, reason, reviewedAt } = input;
        const client = await db_1.default.connect();
        try {
            const updateParams = [status, category || null, reason, userId, name, language];
            const updateResult = await client.query(`
        UPDATE templates 
        SET 
          status = $1,
          category = COALESCE($2, category),
          rejection_reason = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4 AND name = $5 AND language = $6
        RETURNING id, name, category
      `, updateParams);
            if (updateResult.rows.length > 0) {
                console.log(`✅ [TEMPLATES_REPO] Updated template: ${name} (${language}) -> ${status} for user ${userId}`);
                return;
            }
            try {
                const insertParams = [userId, name, language, status, category || 'UTILITY', reason];
                await client.query(`
          INSERT INTO templates (
            user_id, name, language, status, category, rejection_reason, 
            components, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 
            '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, insertParams);
                console.log(`🆕 [TEMPLATES_REPO] Created template from webhook: ${name} (${language}) for user ${userId}`);
            }
            catch (insertError) {
                if (insertError.code === '23505') {
                    console.log(`🔄 [TEMPLATES_REPO] Unique constraint conflict, updating without language filter for ${name}`);
                    const fallbackParams = [status, category || null, reason, language, userId, name];
                    await client.query(`
            UPDATE templates 
            SET 
              status = $1,
              category = COALESCE($2, category),
              rejection_reason = $3,
              language = $4,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5 AND name = $6
          `, fallbackParams);
                    console.log(`✅ [TEMPLATES_REPO] Updated existing template (different language): ${name} for user ${userId}`);
                }
                else {
                    throw insertError;
                }
            }
        }
        finally {
            client.release();
        }
    },
    async getByUserNameLanguage(userId, name, language) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`
        SELECT * FROM templates 
        WHERE user_id = $1 AND name = $2 AND language = $3
        LIMIT 1
      `, [userId, name, language]);
            return result.rows.length > 0 ? result.rows[0] : null;
        }
        finally {
            client.release();
        }
    },
    async getAllByUserId(userId) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`
        SELECT id, name, language, status, category, rejection_reason, 
               created_at, updated_at, quality_rating
        FROM templates 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
};
exports.userBusinessRepo = {
    async getByPhoneNumberIdWithCreds(phoneNumberId) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`
        SELECT user_id as "userId", waba_id as "wabaId", access_token as "accessToken"
        FROM user_business_info
        WHERE whatsapp_number_id = $1 AND is_active = true
        LIMIT 1
      `, [phoneNumberId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        }
        finally {
            client.release();
        }
    },
    async getByWabaIdWithCreds(wabaId) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`
        SELECT user_id as "userId", waba_id as "wabaId", access_token as "accessToken"
        FROM user_business_info
        WHERE waba_id = $1 AND is_active = true
        LIMIT 1
      `, [wabaId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        }
        finally {
            client.release();
        }
    },
    async getCredsByUserId(userId) {
        const client = await db_1.default.connect();
        try {
            const result = await client.query(`
        SELECT waba_id as "wabaId", access_token as "accessToken"
        FROM user_business_info
        WHERE user_id = $1 AND is_active = true
        LIMIT 1
      `, [userId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        }
        finally {
            client.release();
        }
    }
};
//# sourceMappingURL=templatesRepo.js.map