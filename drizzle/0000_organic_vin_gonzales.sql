CREATE TABLE `dreams` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`dream` text NOT NULL,
	`mood` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`analysis` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dreams_device_created_idx` ON `dreams` (`device_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `monthly_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`month` text NOT NULL,
	`entry_count` integer NOT NULL,
	`summary` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monthly_summaries_device_month_idx` ON `monthly_summaries` (`device_id`,`month`);