CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_owner` ON `records` (`owner`);--> statement-breakpoint
CREATE INDEX `records_kind` ON `records` (`kind`);