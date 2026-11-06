CREATE TABLE `outbox` (
	`action_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`local_id` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_account_created` ON `outbox` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `records` (
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`server_updated_at` text,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `records_kind` ON `records` (`kind`);