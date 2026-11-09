DROP INDEX "students_lrn_idx";--> statement-breakpoint
DROP INDEX "users_lrn_idx";--> statement-breakpoint
CREATE INDEX "students_lrn_idx" ON "students" USING btree ("lrn");--> statement-breakpoint
CREATE INDEX "users_lrn_idx" ON "users" USING btree ("lrn");