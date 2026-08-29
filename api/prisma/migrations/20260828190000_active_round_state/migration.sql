ALTER TABLE "VoteRound" ADD COLUMN "timerType" TEXT;
ALTER TABLE "VoteRound" ADD COLUMN "timerDeadline" TIMESTAMP(3);
ALTER TABLE "SprintReport" ADD COLUMN "urlExportPdf" TEXT;
