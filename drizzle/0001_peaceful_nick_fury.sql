CREATE TABLE `api_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_rate_limits_expires_idx` ON `api_rate_limits` (`expires_at`);