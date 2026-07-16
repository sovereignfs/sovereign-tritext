CREATE TABLE `content_block_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`order_number` integer DEFAULT 0 NOT NULL,
	`is_collapsed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`group_id` text,
	`block_type` text DEFAULT 'text' NOT NULL,
	`sinhala_text` text,
	`tamil_text` text,
	`english_text` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sinhala_status` text DEFAULT 'draft' NOT NULL,
	`tamil_status` text DEFAULT 'draft' NOT NULL,
	`english_status` text DEFAULT 'draft' NOT NULL,
	`character_limit` integer,
	`word_limit` integer,
	`order_number` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`sinhala_locked` integer DEFAULT false NOT NULL,
	`tamil_locked` integer DEFAULT false NOT NULL,
	`english_locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `content_block_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `custom_fonts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`family_name` text NOT NULL,
	`display_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`supported_scripts` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`order_number` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`can_edit_sinhala` integer DEFAULT false NOT NULL,
	`can_edit_tamil` integer DEFAULT false NOT NULL,
	`can_edit_english` integer DEFAULT false NOT NULL,
	`invited_at` integer NOT NULL,
	`invited_by` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`deadline` integer,
	`language_mode` text DEFAULT 'trilingual' NOT NULL,
	`enabled_languages` text NOT NULL,
	`primary_language` text DEFAULT 'sinhala' NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
