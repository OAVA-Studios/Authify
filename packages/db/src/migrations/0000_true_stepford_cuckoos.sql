CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" text,
	"api_key_hash" varchar(512),
	"api_key_salt" varchar(256),
	"owner_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"cors_origins" jsonb DEFAULT '["*"]'::jsonb,
	"rate_limit_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"actor_type" varchar(32) DEFAULT 'user' NOT NULL,
	"action" varchar(128) NOT NULL,
	"resource_type" varchar(128) NOT NULL,
	"resource_id" varchar(256),
	"ip_address" varchar(64),
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" varchar(512) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"provider_account_id" varchar(512) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" varchar(32),
	"scope" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" varchar(512) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" varchar(512) NOT NULL,
	"refresh_token" varchar(512),
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factor_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"secret" varchar(512) NOT NULL,
	"backup_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_auth_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(256),
	"email_verified" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"app_id" uuid,
	"type" varchar(32) NOT NULL,
	"value" varchar(512) NOT NULL,
	"reason" text,
	"permanent" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"hwid" varchar(512) NOT NULL,
	"ip_address" varchar(64),
	"device_name" varchar(256),
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"version" varchar(64) DEFAULT '1.0.0' NOT NULL,
	"hwid_locking" boolean DEFAULT true NOT NULL,
	"max_devices" integer DEFAULT 1 NOT NULL,
	"webhook_url" text,
	"anti_debug" boolean DEFAULT false NOT NULL,
	"encryption_key" varchar(512),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"key" varchar(128) NOT NULL,
	"user_id" uuid,
	"tier" varchar(64) DEFAULT 'basic' NOT NULL,
	"max_activations" integer DEFAULT 1 NOT NULL,
	"current_activations" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "license_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"value" text NOT NULL,
	"type" varchar(64) DEFAULT 'string' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"event" varchar(128) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"status_code" integer,
	"response_body" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"max_file_size" bigint DEFAULT 1073741824,
	"allowed_mime_types" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(512) NOT NULL,
	"path" text NOT NULL,
	"mime_type" varchar(256) NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"etag" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"operation" varchar(32) NOT NULL,
	"condition" text NOT NULL,
	"role" varchar(64),
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"table_name" varchar(256) NOT NULL,
	"schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rls_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_table_name_unique" UNIQUE("table_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "function_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"request" jsonb DEFAULT '{}'::jsonb,
	"response" jsonb DEFAULT '{}'::jsonb,
	"logs" text,
	"duration_ms" integer,
	"memory_used_mb" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "serverless_functions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"entrypoint" varchar(512) DEFAULT 'index.js' NOT NULL,
	"runtime" varchar(64) DEFAULT 'node22' NOT NULL,
	"source_code" text,
	"source_path" varchar(512),
	"env_vars" jsonb DEFAULT '{}'::jsonb,
	"trigger_type" varchar(64) DEFAULT 'http' NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb,
	"timeout" integer DEFAULT 30000 NOT NULL,
	"memory" integer DEFAULT 256 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" varchar(32) NOT NULL,
	"subject" varchar(512),
	"body" text NOT NULL,
	"html_body" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"template_id" uuid,
	"type" varchar(32) NOT NULL,
	"to" varchar(512) NOT NULL,
	"subject" varchar(512),
	"body" text,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messaging_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" varchar(32) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"event" varchar(128) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"status_code" integer,
	"response_body" text,
	"success" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(512),
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"retries" integer DEFAULT 3 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_project_id_idx" ON "audit_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verif_token_idx" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_provider_account_idx" ON "oauth_accounts" USING btree ("project_id","provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pw_reset_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pw_reset_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_refresh_token_idx" ON "sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tfa_user_id_idx" ON "two_factor_auth" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_project_email_idx" ON "users" USING btree ("project_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_project_id_idx" ON "users" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_banned_idx" ON "users" USING btree ("banned");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blacklist_project_type_value_idx" ON "blacklist" USING btree ("project_id","type","value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blacklist_app_id_idx" ON "blacklist" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_activations_key_id_idx" ON "license_activations" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_activations_hwid_idx" ON "license_activations" USING btree ("hwid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_activations_active_idx" ON "license_activations" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_apps_project_id_idx" ON "license_apps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_apps_name_idx" ON "license_apps" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_keys_app_id_idx" ON "license_keys" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_keys_key_idx" ON "license_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_keys_project_id_idx" ON "license_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_keys_status_idx" ON "license_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_keys_user_id_idx" ON "license_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_variables_app_name_idx" ON "license_variables" USING btree ("app_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_webhook_logs_app_id_idx" ON "license_webhook_logs" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_webhook_logs_event_idx" ON "license_webhook_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "license_webhook_logs_sent_at_idx" ON "license_webhook_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buckets_project_id_idx" ON "storage_buckets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buckets_name_idx" ON "storage_buckets" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_bucket_id_idx" ON "storage_files" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_path_idx" ON "storage_files" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_project_id_idx" ON "storage_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policies_collection_id_idx" ON "collection_policies" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policies_operation_idx" ON "collection_policies" USING btree ("operation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collections_project_id_idx" ON "collections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collections_name_idx" ON "collections" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "executions_function_id_idx" ON "function_executions" USING btree ("function_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "executions_status_idx" ON "function_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "executions_created_at_idx" ON "function_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "functions_project_id_idx" ON "serverless_functions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "functions_slug_idx" ON "serverless_functions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_project_id_idx" ON "message_templates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_name_idx" ON "message_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_project_id_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_status_idx" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messaging_providers_project_id_idx" ON "messaging_providers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messaging_providers_type_idx" ON "messaging_providers" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_event_idx" ON "webhook_deliveries" USING btree ("event");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_success_idx" ON "webhook_deliveries" USING btree ("success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_created_at_idx" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_project_id_idx" ON "webhooks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_active_idx" ON "webhooks" USING btree ("active");