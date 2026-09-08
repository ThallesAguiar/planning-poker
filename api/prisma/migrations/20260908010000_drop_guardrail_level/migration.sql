-- AlterTable
-- Guardrail level is now fixed internally ("moderate"): the per-account column
-- is no longer used, so it is dropped.
ALTER TABLE "AiAgent" DROP COLUMN "guardrailLevel";