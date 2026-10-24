CREATE TABLE "market_data_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"expected_bars" integer NOT NULL,
	"stored_bars" integer NOT NULL,
	"gap_count" integer DEFAULT 0 NOT NULL,
	"first_bar_at" timestamp with time zone,
	"last_bar_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_market_data_coverage_expected_bars_1" CHECK ("market_data_coverage"."expected_bars" >= 0),
	CONSTRAINT "chk_market_data_coverage_stored_bars_2" CHECK ("market_data_coverage"."stored_bars" >= 0),
	CONSTRAINT "chk_market_data_coverage_gap_count_3" CHECK ("market_data_coverage"."gap_count" >= 0),
	CONSTRAINT "chk_market_data_coverage_status_4" CHECK ("market_data_coverage"."status" in ('complete', 'partial', 'missing'))
);
--> statement-breakpoint
CREATE TABLE "account_instrument_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"is_tradable" boolean DEFAULT true NOT NULL,
	"product_allowlist" text[] NOT NULL,
	"max_quantity" numeric(20, 4),
	"max_open_quantity" numeric(20, 4),
	"reason" text,
	"effective_from" date DEFAULT current_date NOT NULL,
	"effective_to" date,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_account_instrument_permissions_product_allowlist_1" CHECK ("account_instrument_permissions"."product_allowlist" <@ array['intraday','delivery','co','mtf']::text[]),
	CONSTRAINT "chk_account_instrument_permissions_max_quantity_2" CHECK ("account_instrument_permissions"."max_quantity" > 0),
	CONSTRAINT "chk_account_instrument_permissions_max_open_quantity_3" CHECK ("account_instrument_permissions"."max_open_quantity" > 0),
	CONSTRAINT "chk_account_instrument_permissions_effective_to_4" CHECK ("account_instrument_permissions"."effective_to" > "account_instrument_permissions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"broker_provider_id" uuid NOT NULL,
	"broker_user_ref" varchar(80),
	"base_currency" char(3) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"timezone" varchar(50) DEFAULT 'Asia/Kolkata' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"opened_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_accounts_mode_1" CHECK ("accounts"."mode" in ('offline', 'research', 'backtesting', 'paper', 'live'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"account_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"request_id" uuid,
	"ip_address" "inet" NOT NULL,
	"user_agent" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"credential_type" varchar(30) NOT NULL,
	"encrypted_value" "bytea" NOT NULL,
	"encryption_key_version" smallint DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_broker_credentials_credential_type_1" CHECK ("broker_credentials"."credential_type" in ('api_key', 'api_secret', 'access_token', 'refresh_token', 'totp_secret'))
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(60) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"publish_attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_account_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "chk_user_account_access_role_1" CHECK ("user_account_access"."role" in ('owner', 'trader', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"failed_login_count" smallint DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_users_role_1" CHECK ("users"."role" in ('admin', 'operator', 'viewer')),
	CONSTRAINT "chk_users_status_2" CHECK ("users"."status" in ('active', 'disabled', 'locked'))
);
--> statement-breakpoint
CREATE TABLE "corporate_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"action_type" varchar(30) NOT NULL,
	"ex_date" date NOT NULL,
	"record_date" date,
	"ratio_numerator" numeric(20, 6),
	"ratio_denominator" numeric(20, 6),
	"dividend_per_share" numeric(20, 4),
	"price_adjustment_factor" numeric(20, 10) DEFAULT '1' NOT NULL,
	"volume_adjustment_factor" numeric(20, 10) DEFAULT '1' NOT NULL,
	"source" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_corporate_actions_action_type_1" CHECK ("corporate_actions"."action_type" in ('split', 'bonus', 'dividend', 'merger', 'demerger', 'rights', 'symbol_change')),
	CONSTRAINT "chk_corporate_actions_ratio_numerator_2" CHECK ("corporate_actions"."ratio_numerator" > 0 and "corporate_actions"."ratio_denominator" > 0),
	CONSTRAINT "chk_corporate_actions_dividend_per_share_3" CHECK ("corporate_actions"."dividend_per_share" >= 0),
	CONSTRAINT "chk_corporate_actions_price_adjustment_factor_4" CHECK ("corporate_actions"."price_adjustment_factor" > 0),
	CONSTRAINT "chk_corporate_actions_volume_adjustment_factor_5" CHECK ("corporate_actions"."volume_adjustment_factor" > 0),
	CONSTRAINT "chk_corporate_actions_status_6" CHECK ("corporate_actions"."status" in ('announced', 'confirmed', 'applied'))
);
--> statement-breakpoint
CREATE TABLE "data_quality_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid,
	"instrument_id" uuid,
	"issue_type" varchar(60) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"trading_date" date,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"detected_by" varchar(30) NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_data_quality_issues_issue_type_1" CHECK ("data_quality_issues"."issue_type" in ('missing_bar', 'duplicate_bar', 'invalid_ohlc', 'stale_quote', 'gap', 'outlier', 'corporate_action_mismatch', 'mapping_missing', 'coverage_shortfall')),
	CONSTRAINT "chk_data_quality_issues_severity_2" CHECK ("data_quality_issues"."severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "chk_data_quality_issues_window_start_3" CHECK ("data_quality_issues"."window_end" is null or "data_quality_issues"."window_start" is null or "data_quality_issues"."window_end" > "data_quality_issues"."window_start"),
	CONSTRAINT "chk_data_quality_issues_status_4" CHECK ("data_quality_issues"."status" in ('open', 'acknowledged', 'resolved', 'ignored')),
	CONSTRAINT "chk_data_quality_issues_detected_by_5" CHECK ("data_quality_issues"."detected_by" in ('ingestion', 'validation', 'reconciliation', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "exchanges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"mic" char(4),
	"name" varchar(120) NOT NULL,
	"timezone" varchar(50) DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument_provider_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"external_key" varchar(120) NOT NULL,
	"exchange_token" varchar(40),
	"provider_symbol" varchar(80),
	"provider_segment" varchar(30),
	"is_primary" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_instrument_provider_mappings_valid_from_1" CHECK ("instrument_provider_mappings"."valid_to" is null or "instrument_provider_mappings"."valid_to" > "instrument_provider_mappings"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "instrument_universe_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_version_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"median_traded_value" numeric(20, 2),
	"added_at" date NOT NULL,
	"removed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_instrument_universe_members_rank_1" CHECK ("instrument_universe_members"."rank" > 0),
	CONSTRAINT "chk_instrument_universe_members_median_traded_value_2" CHECK ("instrument_universe_members"."median_traded_value" >= 0),
	CONSTRAINT "chk_instrument_universe_members_added_at_3" CHECK ("instrument_universe_members"."removed_at" is null or "instrument_universe_members"."removed_at" >= "instrument_universe_members"."added_at")
);
--> statement-breakpoint
CREATE TABLE "instrument_universe_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"member_count" integer DEFAULT 0 NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_provider_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_instrument_universe_versions_version_1" CHECK ("instrument_universe_versions"."version" > 0),
	CONSTRAINT "chk_instrument_universe_versions_effective_from_2" CHECK ("instrument_universe_versions"."effective_to" is null or "instrument_universe_versions"."effective_to" > "instrument_universe_versions"."effective_from"),
	CONSTRAINT "chk_instrument_universe_versions_member_count_3" CHECK ("instrument_universe_versions"."member_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "instrument_universes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"selection_method" varchar(40) NOT NULL,
	"lookback_sessions" integer,
	"refresh_cadence" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_instrument_universes_selection_method_1" CHECK ("instrument_universes"."selection_method" in ('manual', 'liquidity_median_value', 'index_constituents')),
	CONSTRAINT "chk_instrument_universes_lookback_sessions_2" CHECK ("instrument_universes"."lookback_sessions" > 0),
	CONSTRAINT "chk_instrument_universes_refresh_cadence_3" CHECK ("instrument_universes"."refresh_cadence" in ('daily', 'weekly', 'monthly', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" uuid NOT NULL,
	"trading_symbol" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(80),
	"isin" char(12),
	"segment" varchar(20) NOT NULL,
	"instrument_type" varchar(20) NOT NULL,
	"lot_size" integer DEFAULT 1 NOT NULL,
	"tick_size" numeric(10, 4) DEFAULT '0.05' NOT NULL,
	"freeze_quantity" numeric(20, 4),
	"is_active" boolean DEFAULT true NOT NULL,
	"listed_on" date,
	"delisted_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_instruments_lot_size_1" CHECK ("instruments"."lot_size" > 0),
	CONSTRAINT "chk_instruments_tick_size_2" CHECK ("instruments"."tick_size" > 0),
	CONSTRAINT "chk_instruments_freeze_quantity_3" CHECK ("instruments"."freeze_quantity" > 0),
	CONSTRAINT "chk_instruments_delisted_on_4" CHECK ("instruments"."delisted_on" is null or "instruments"."delisted_on" >= "instruments"."listed_on")
);
--> statement-breakpoint
CREATE TABLE "market_data_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"run_type" varchar(30) NOT NULL,
	"instrument_id" uuid,
	"timeframe_unit" varchar(10),
	"timeframe_interval" integer,
	"requested_from" date,
	"requested_to" date,
	"status" varchar(20) NOT NULL,
	"rows_fetched" integer DEFAULT 0 NOT NULL,
	"rows_written" integer DEFAULT 0 NOT NULL,
	"rows_rejected" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"raw_payload_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_market_data_ingestion_runs_run_type_1" CHECK ("market_data_ingestion_runs"."run_type" in ('instrument_master', 'historical_backfill', 'intraday_sync', 'quote_snapshot', 'corporate_actions', 'calendar')),
	CONSTRAINT "chk_market_data_ingestion_runs_timeframe_unit_2" CHECK ("market_data_ingestion_runs"."timeframe_unit" in ('minutes','hours','days','weeks','months') and "market_data_ingestion_runs"."timeframe_interval" > 0),
	CONSTRAINT "chk_market_data_ingestion_runs_requested_from_3" CHECK ("market_data_ingestion_runs"."requested_to" >= "market_data_ingestion_runs"."requested_from"),
	CONSTRAINT "chk_market_data_ingestion_runs_status_4" CHECK ("market_data_ingestion_runs"."status" in ('queued', 'running', 'succeeded', 'partially_failed', 'failed')),
	CONSTRAINT "chk_market_data_ingestion_runs_rows_fetched_5" CHECK ("market_data_ingestion_runs"."rows_fetched" >= 0),
	CONSTRAINT "chk_market_data_ingestion_runs_rows_written_6" CHECK ("market_data_ingestion_runs"."rows_written" >= 0),
	CONSTRAINT "chk_market_data_ingestion_runs_rows_rejected_7" CHECK ("market_data_ingestion_runs"."rows_rejected" >= 0),
	CONSTRAINT "chk_market_data_ingestion_runs_started_at_8" CHECK ("market_data_ingestion_runs"."finished_at" is null or "market_data_ingestion_runs"."started_at" is null or "market_data_ingestion_runs"."finished_at" >= "market_data_ingestion_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_providers_kind_1" CHECK ("providers"."kind" in ('broker', 'market_data', 'both', 'internal'))
);
--> statement-breakpoint
CREATE TABLE "raw_provider_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"endpoint" varchar(160) NOT NULL,
	"http_method" varchar(10) NOT NULL,
	"request_fingerprint" char(64) NOT NULL,
	"request_params" jsonb,
	"http_status" smallint NOT NULL,
	"content_encoding" varchar(20),
	"payload" jsonb NOT NULL,
	"payload_bytes" integer NOT NULL,
	"payload_sha256" char(64) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_class" varchar(20) NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "chk_raw_provider_payloads_http_status_1" CHECK ("raw_provider_payloads"."http_status" between 100 and 599),
	CONSTRAINT "chk_raw_provider_payloads_retention_class_2" CHECK ("raw_provider_payloads"."retention_class" in ('standard', 'extended', 'errors'))
);
--> statement-breakpoint
CREATE TABLE "trading_calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"is_trading_day" boolean DEFAULT true NOT NULL,
	"session_open" timestamp with time zone,
	"session_close" timestamp with time zone,
	"pre_open_start" timestamp with time zone,
	"closing_auction_start" timestamp with time zone,
	"closing_auction_end" timestamp with time zone,
	"settlement_date" date,
	"description" varchar(200),
	"source_provider_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_trading_calendar_session_open_1" CHECK ("trading_calendar"."session_close" > "trading_calendar"."session_open")
);
--> statement-breakpoint
CREATE TABLE "configuration_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_type" varchar(30) NOT NULL,
	"scope_key" varchar(80) NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" char(64) NOT NULL,
	"schema_version" varchar(20) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"supersedes_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_configuration_versions_config_type_1" CHECK ("configuration_versions"."config_type" in ('strategy', 'risk', 'system')),
	CONSTRAINT "chk_configuration_versions_version_2" CHECK ("configuration_versions"."version" > 0),
	CONSTRAINT "chk_configuration_versions_effective_from_3" CHECK ("configuration_versions"."effective_to" is null or "configuration_versions"."effective_to" > "configuration_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "risk_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trading_session_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"strategy_version_id" uuid,
	"instrument_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"rule_code" varchar(60),
	"observed_value" numeric(20, 4),
	"limit_value" numeric(20, 4),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_risk_events_event_type_1" CHECK ("risk_events"."event_type" in ('limit_breach', 'trade_blocked', 'kill_switch', 'stale_data', 'protective_order_failure', 'reconciliation_mismatch', 'manual_override', 'data_quality_block')),
	CONSTRAINT "chk_risk_events_severity_2" CHECK ("risk_events"."severity" in ('info', 'warning', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"status" varchar(20) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategies_status_1" CHECK ("strategies"."status" in ('draft', 'research', 'active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "strategy_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"mode" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	"deactivated_at" timestamp with time zone,
	"activated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategy_activations_mode_1" CHECK ("strategy_activations"."mode" in ('research', 'backtesting', 'paper', 'live')),
	CONSTRAINT "chk_strategy_activations_status_2" CHECK ("strategy_activations"."status" in ('scheduled', 'active', 'paused', 'stopped')),
	CONSTRAINT "chk_strategy_activations_activated_at_3" CHECK ("strategy_activations"."deactivated_at" is null or "strategy_activations"."deactivated_at" > "strategy_activations"."activated_at")
);
--> statement-breakpoint
CREATE TABLE "strategy_config_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"role" varchar(30) NOT NULL,
	"bound_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bound_by" uuid,
	CONSTRAINT "chk_strategy_config_bindings_role_1" CHECK ("strategy_config_bindings"."role" in ('parameters', 'risk', 'execution'))
);
--> statement-breakpoint
CREATE TABLE "strategy_universe_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"universe_version_id" uuid,
	"rank" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategy_universe_members_rank_1" CHECK ("strategy_universe_members"."rank" > 0),
	CONSTRAINT "chk_strategy_universe_members_effective_from_2" CHECK ("strategy_universe_members"."effective_to" is null or "strategy_universe_members"."effective_to" > "strategy_universe_members"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"code_ref" varchar(120) NOT NULL,
	"parameter_schema" jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"changelog" text,
	"released_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategy_versions_version_1" CHECK ("strategy_versions"."version" > 0),
	CONSTRAINT "chk_strategy_versions_status_2" CHECK ("strategy_versions"."status" in ('draft', 'validated', 'active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "trading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"mode" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"configuration_version_id" uuid,
	"opening_equity" numeric(20, 2),
	"closing_equity" numeric(20, 2),
	"kill_switch_engaged" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_trading_sessions_mode_1" CHECK ("trading_sessions"."mode" in ('offline', 'research', 'backtesting', 'paper', 'live')),
	CONSTRAINT "chk_trading_sessions_status_2" CHECK ("trading_sessions"."status" in ('scheduled', 'open', 'closed', 'aborted')),
	CONSTRAINT "chk_trading_sessions_started_at_3" CHECK ("trading_sessions"."ended_at" is null or "trading_sessions"."ended_at" > "trading_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "account_equity_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"trading_date" date NOT NULL,
	"snapshot_type" varchar(20) NOT NULL,
	"available_cash" numeric(20, 2),
	"cash_opening_balance" numeric(20, 2),
	"cash_added_today" numeric(20, 2),
	"cash_withdrawn_today" numeric(20, 2),
	"amount_from_stock_sale" numeric(20, 2),
	"collateral_value" numeric(20, 2),
	"utilized_margin" numeric(20, 2),
	"realized_pnl" numeric(20, 2) NOT NULL,
	"unrealized_pnl" numeric(20, 2) NOT NULL,
	"net_equity" numeric(20, 2),
	"drawdown_pct" numeric(10, 6),
	"source" varchar(20) NOT NULL,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_account_equity_snapshots_snapshot_type_1" CHECK ("account_equity_snapshots"."snapshot_type" in ('session_open', 'intraday', 'session_close', 'broker_sync')),
	CONSTRAINT "chk_account_equity_snapshots_amount_from_stock_sale_2" CHECK ("account_equity_snapshots"."amount_from_stock_sale" >= 0),
	CONSTRAINT "chk_account_equity_snapshots_collateral_value_3" CHECK ("account_equity_snapshots"."collateral_value" >= 0),
	CONSTRAINT "chk_account_equity_snapshots_utilized_margin_4" CHECK ("account_equity_snapshots"."utilized_margin" >= 0),
	CONSTRAINT "chk_account_equity_snapshots_drawdown_pct_5" CHECK ("account_equity_snapshots"."drawdown_pct" >= 0),
	CONSTRAINT "chk_account_equity_snapshots_source_6" CHECK ("account_equity_snapshots"."source" in ('broker', 'computed'))
);
--> statement-breakpoint
CREATE TABLE "broker_position_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"trading_date" date NOT NULL,
	"instrument_id" uuid NOT NULL,
	"product" varchar(10) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"overnight_quantity" numeric(20, 4) NOT NULL,
	"average_price" numeric(20, 4),
	"last_price" numeric(20, 4),
	"close_price" numeric(20, 4),
	"unrealized_pnl" numeric(20, 2) NOT NULL,
	"realized_pnl" numeric(20, 2) NOT NULL,
	"broker_pnl" numeric(20, 2) NOT NULL,
	"day_buy_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"day_sell_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"multiplier" numeric(20, 4) DEFAULT '1' NOT NULL,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_broker_position_snapshots_product_1" CHECK ("broker_position_snapshots"."product" in ('intraday', 'delivery', 'co', 'mtf')),
	CONSTRAINT "chk_broker_position_snapshots_average_price_2" CHECK ("broker_position_snapshots"."average_price" >= 0),
	CONSTRAINT "chk_broker_position_snapshots_last_price_3" CHECK ("broker_position_snapshots"."last_price" >= 0),
	CONSTRAINT "chk_broker_position_snapshots_close_price_4" CHECK ("broker_position_snapshots"."close_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"broker_trade_id" varchar(80) NOT NULL,
	"exchange_trade_id" varchar(80),
	"side" varchar(10) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"price" numeric(20, 4) NOT NULL,
	"gross_amount" numeric(20, 2) NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"exchange_timestamp" timestamp with time zone NOT NULL,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_fills_side_1" CHECK ("fills"."side" in ('buy', 'sell')),
	CONSTRAINT "chk_fills_quantity_2" CHECK ("fills"."quantity" > 0),
	CONSTRAINT "chk_fills_price_3" CHECK ("fills"."price" > 0),
	CONSTRAINT "chk_fills_gross_amount_4" CHECK ("fills"."gross_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "holdings_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"trading_date" date NOT NULL,
	"instrument_id" uuid NOT NULL,
	"isin" char(12) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"t1_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"collateral_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"average_price" numeric(20, 4),
	"last_price" numeric(20, 4),
	"close_price" numeric(20, 4),
	"pnl" numeric(20, 2) NOT NULL,
	"day_change" numeric(20, 4),
	"day_change_pct" numeric(20, 4),
	"haircut" numeric(10, 6),
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_holdings_snapshots_quantity_1" CHECK ("holdings_snapshots"."quantity" >= 0),
	CONSTRAINT "chk_holdings_snapshots_average_price_2" CHECK ("holdings_snapshots"."average_price" >= 0),
	CONSTRAINT "chk_holdings_snapshots_last_price_3" CHECK ("holdings_snapshots"."last_price" >= 0),
	CONSTRAINT "chk_holdings_snapshots_close_price_4" CHECK ("holdings_snapshots"."close_price" >= 0),
	CONSTRAINT "chk_holdings_snapshots_haircut_5" CHECK ("holdings_snapshots"."haircut" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_order_events_sequence_1" CHECK ("order_events"."sequence" > 0),
	CONSTRAINT "chk_order_events_event_type_2" CHECK ("order_events"."event_type" in ('created', 'submitted', 'acknowledged', 'partially_filled', 'filled', 'modified', 'cancelled', 'rejected', 'expired', 'reconciled', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trading_session_id" uuid NOT NULL,
	"signal_id" uuid,
	"strategy_version_id" uuid,
	"instrument_id" uuid NOT NULL,
	"parent_order_id" uuid,
	"broker_order_id" varchar(80),
	"exchange_order_id" varchar(80),
	"client_order_ref" varchar(80) NOT NULL,
	"order_ref_id" varchar(80),
	"side" varchar(10) NOT NULL,
	"order_type" varchar(20) NOT NULL,
	"product" varchar(10) NOT NULL,
	"validity" varchar(10) NOT NULL,
	"variety" varchar(20) NOT NULL,
	"status" varchar(30) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"filled_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"pending_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"cancelled_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"price" numeric(20, 4),
	"trigger_price" numeric(20, 4),
	"average_fill_price" numeric(20, 4),
	"disclosed_quantity" numeric(20, 4),
	"is_amo" boolean NOT NULL,
	"tag" varchar(40) NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"broker_updated_at" timestamp with time zone NOT NULL,
	"status_message" text,
	"status_message_raw" text,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_orders_side_1" CHECK ("orders"."side" in ('buy', 'sell')),
	CONSTRAINT "chk_orders_order_type_2" CHECK ("orders"."order_type" in ('market', 'limit', 'sl', 'sl_m')),
	CONSTRAINT "chk_orders_product_3" CHECK ("orders"."product" in ('intraday', 'delivery', 'co', 'mtf')),
	CONSTRAINT "chk_orders_validity_4" CHECK ("orders"."validity" in ('day', 'ioc')),
	CONSTRAINT "chk_orders_variety_5" CHECK ("orders"."variety" in ('simple', 'amo', 'co')),
	CONSTRAINT "chk_orders_status_6" CHECK ("orders"."status" in ('pending_new', 'submitted', 'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired', 'unknown')),
	CONSTRAINT "chk_orders_quantity_7" CHECK ("orders"."quantity" > 0),
	CONSTRAINT "chk_orders_filled_quantity_8" CHECK ("orders"."filled_quantity" + "orders"."pending_quantity" + "orders"."cancelled_quantity" <= "orders"."quantity"),
	CONSTRAINT "chk_orders_price_9" CHECK ("orders"."price" >= 0),
	CONSTRAINT "chk_orders_trigger_price_10" CHECK ("orders"."trigger_price" >= 0),
	CONSTRAINT "chk_orders_average_fill_price_11" CHECK ("orders"."average_fill_price" >= 0),
	CONSTRAINT "chk_orders_disclosed_quantity_12" CHECK ("orders"."disclosed_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "position_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"quantity_delta" numeric(20, 4) NOT NULL,
	"price" numeric(20, 4),
	"realized_pnl_delta" numeric(20, 2) DEFAULT '0' NOT NULL,
	"fill_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_position_events_event_type_1" CHECK ("position_events"."event_type" in ('opened', 'increased', 'reduced', 'closed', 'stop_moved', 'target_moved', 'reconciled')),
	CONSTRAINT "chk_position_events_price_2" CHECK ("position_events"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"product" varchar(10) NOT NULL,
	"trading_session_id" uuid,
	"strategy_version_id" uuid,
	"quantity" numeric(20, 4) NOT NULL,
	"overnight_quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"average_price" numeric(20, 4),
	"last_price" numeric(20, 4),
	"market_value" numeric(20, 2),
	"realized_pnl" numeric(20, 2) DEFAULT '0' NOT NULL,
	"unrealized_pnl" numeric(20, 2) DEFAULT '0' NOT NULL,
	"stop_price" numeric(20, 4),
	"target_price" numeric(20, 4),
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_positions_product_1" CHECK ("positions"."product" in ('intraday', 'delivery', 'co', 'mtf')),
	CONSTRAINT "chk_positions_quantity_2" CHECK ("positions"."status" <> 'open' or "positions"."quantity" <> 0),
	CONSTRAINT "chk_positions_average_price_3" CHECK ("positions"."average_price" > 0),
	CONSTRAINT "chk_positions_last_price_4" CHECK ("positions"."last_price" > 0),
	CONSTRAINT "chk_positions_stop_price_5" CHECK ("positions"."stop_price" > 0),
	CONSTRAINT "chk_positions_target_price_6" CHECK ("positions"."target_price" > 0),
	CONSTRAINT "chk_positions_opened_at_7" CHECK ("positions"."closed_at" is null or "positions"."closed_at" > "positions"."opened_at"),
	CONSTRAINT "chk_positions_status_8" CHECK ("positions"."status" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid,
	"field_name" varchar(60) NOT NULL,
	"internal_value" text,
	"broker_value" text,
	"severity" varchar(20) NOT NULL,
	"resolution_status" varchar(20) NOT NULL,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reconciliation_issues_entity_type_1" CHECK ("reconciliation_issues"."entity_type" in ('order', 'position', 'holding', 'funds')),
	CONSTRAINT "chk_reconciliation_issues_severity_2" CHECK ("reconciliation_issues"."severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "chk_reconciliation_issues_resolution_status_3" CHECK ("reconciliation_issues"."resolution_status" in ('open', 'resolved', 'ignored'))
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"orders_checked" integer DEFAULT 0 NOT NULL,
	"positions_checked" integer DEFAULT 0 NOT NULL,
	"mismatches_count" integer DEFAULT 0 NOT NULL,
	"raw_payload_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reconciliations_started_at_1" CHECK ("reconciliations"."finished_at" is null or "reconciliations"."started_at" is null or "reconciliations"."finished_at" >= "reconciliations"."started_at"),
	CONSTRAINT "chk_reconciliations_status_2" CHECK ("reconciliations"."status" in ('running', 'matched', 'mismatched', 'failed')),
	CONSTRAINT "chk_reconciliations_orders_checked_3" CHECK ("reconciliations"."orders_checked" >= 0),
	CONSTRAINT "chk_reconciliations_positions_checked_4" CHECK ("reconciliations"."positions_checked" >= 0),
	CONSTRAINT "chk_reconciliations_mismatches_count_5" CHECK ("reconciliations"."mismatches_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "risk_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"trading_session_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"approved_quantity" numeric(20, 4),
	"risk_percent" numeric(10, 6) NOT NULL,
	"risk_amount" numeric(20, 2),
	"account_equity" numeric(20, 2),
	"available_cash" numeric(20, 2),
	"stop_distance" numeric(20, 4),
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_risk_decisions_outcome_1" CHECK ("risk_decisions"."outcome" in ('approved', 'rejected', 'reduced')),
	CONSTRAINT "chk_risk_decisions_approved_quantity_2" CHECK ("risk_decisions"."approved_quantity" >= 0),
	CONSTRAINT "chk_risk_decisions_risk_percent_3" CHECK ("risk_decisions"."risk_percent" > 0),
	CONSTRAINT "chk_risk_decisions_risk_amount_4" CHECK ("risk_decisions"."risk_amount" >= 0),
	CONSTRAINT "chk_risk_decisions_stop_distance_5" CHECK ("risk_decisions"."stop_distance" > 0)
);
--> statement-breakpoint
CREATE TABLE "round_trip_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"trading_session_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"entry_order_id" uuid,
	"exit_order_id" uuid,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"entry_price" numeric(20, 4) NOT NULL,
	"exit_price" numeric(20, 4) NOT NULL,
	"gross_pnl" numeric(20, 2) NOT NULL,
	"costs_total" numeric(20, 2) DEFAULT '0' NOT NULL,
	"net_pnl" numeric(20, 2) NOT NULL,
	"initial_stop" numeric(20, 4),
	"target" numeric(20, 4),
	"r_multiple" numeric(20, 6),
	"exit_reason" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_round_trip_trades_direction_1" CHECK ("round_trip_trades"."direction" in ('long', 'short')),
	CONSTRAINT "chk_round_trip_trades_quantity_2" CHECK ("round_trip_trades"."quantity" > 0),
	CONSTRAINT "chk_round_trip_trades_entry_at_3" CHECK ("round_trip_trades"."exit_at" is null or "round_trip_trades"."exit_at" > "round_trip_trades"."entry_at"),
	CONSTRAINT "chk_round_trip_trades_entry_price_4" CHECK ("round_trip_trades"."entry_price" > 0),
	CONSTRAINT "chk_round_trip_trades_exit_price_5" CHECK ("round_trip_trades"."exit_price" > 0),
	CONSTRAINT "chk_round_trip_trades_initial_stop_6" CHECK ("round_trip_trades"."initial_stop" > 0),
	CONSTRAINT "chk_round_trip_trades_target_7" CHECK ("round_trip_trades"."target" > 0),
	CONSTRAINT "chk_round_trip_trades_exit_reason_8" CHECK ("round_trip_trades"."exit_reason" in ('target', 'stop', 'eod', 'manual', 'risk', 'reconciliation', 'strategy_exit')),
	CONSTRAINT "chk_round_trip_trades_status_9" CHECK ("round_trip_trades"."status" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"trading_session_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"signal_at" timestamp with time zone NOT NULL,
	"candle_start" timestamp with time zone NOT NULL,
	"direction" varchar(10) NOT NULL,
	"signal_type" varchar(30) NOT NULL,
	"reference_price" numeric(20, 4) NOT NULL,
	"entry_price" numeric(20, 4),
	"stop_price" numeric(20, 4),
	"target_price" numeric(20, 4),
	"quantity" numeric(20, 4),
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_signals_direction_1" CHECK ("signals"."direction" in ('long', 'short')),
	CONSTRAINT "chk_signals_signal_type_2" CHECK ("signals"."signal_type" in ('entry', 'exit', 'stop', 'target', 'eod')),
	CONSTRAINT "chk_signals_reference_price_3" CHECK ("signals"."reference_price" > 0),
	CONSTRAINT "chk_signals_entry_price_4" CHECK ("signals"."entry_price" > 0),
	CONSTRAINT "chk_signals_stop_price_5" CHECK ("signals"."stop_price" > 0),
	CONSTRAINT "chk_signals_target_price_6" CHECK ("signals"."target_price" > 0),
	CONSTRAINT "chk_signals_quantity_7" CHECK ("signals"."quantity" > 0),
	CONSTRAINT "chk_signals_status_8" CHECK ("signals"."status" in ('created', 'risk_pending', 'approved', 'rejected', 'executed', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "trade_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fill_id" uuid NOT NULL,
	"brokerage" numeric(20, 4) NOT NULL,
	"stt" numeric(20, 4) NOT NULL,
	"exchange_charge" numeric(20, 4) NOT NULL,
	"sebi_charge" numeric(20, 4) NOT NULL,
	"stamp_duty" numeric(20, 4) NOT NULL,
	"gst" numeric(20, 4) NOT NULL,
	"other_charges" numeric(20, 4) NOT NULL,
	"total" numeric(20, 4) NOT NULL,
	"currency" char(3) NOT NULL,
	"cost_model_version" varchar(30) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_trade_costs_brokerage_1" CHECK ("trade_costs"."brokerage" >= 0),
	CONSTRAINT "chk_trade_costs_stt_2" CHECK ("trade_costs"."stt" >= 0),
	CONSTRAINT "chk_trade_costs_exchange_charge_3" CHECK ("trade_costs"."exchange_charge" >= 0),
	CONSTRAINT "chk_trade_costs_sebi_charge_4" CHECK ("trade_costs"."sebi_charge" >= 0),
	CONSTRAINT "chk_trade_costs_stamp_duty_5" CHECK ("trade_costs"."stamp_duty" >= 0),
	CONSTRAINT "chk_trade_costs_gst_6" CHECK ("trade_costs"."gst" >= 0),
	CONSTRAINT "chk_trade_costs_other_charges_7" CHECK ("trade_costs"."other_charges" >= 0),
	CONSTRAINT "chk_trade_costs_total_8" CHECK ("trade_costs"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "backtest_equity_curve" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_run_id" uuid NOT NULL,
	"curve_date" date NOT NULL,
	"equity" numeric(20, 2) NOT NULL,
	"cash" numeric(20, 2) NOT NULL,
	"open_pnl" numeric(20, 2) DEFAULT '0' NOT NULL,
	"drawdown_pct" numeric(10, 6) NOT NULL,
	"exposure" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_backtest_equity_curve_drawdown_pct_1" CHECK ("backtest_equity_curve"."drawdown_pct" >= 0),
	CONSTRAINT "chk_backtest_equity_curve_exposure_2" CHECK ("backtest_equity_curve"."exposure" >= 0)
);
--> statement-breakpoint
CREATE TABLE "backtest_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_run_id" uuid NOT NULL,
	"metric_key" varchar(60) NOT NULL,
	"metric_value" numeric(28, 10) NOT NULL,
	"metric_unit" varchar(20),
	"metric_group" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"account_id" uuid,
	"name" varchar(160) NOT NULL,
	"dataset_from" date NOT NULL,
	"dataset_to" date NOT NULL,
	"initial_capital" numeric(20, 2) NOT NULL,
	"cost_model_version" varchar(30) NOT NULL,
	"slippage_model_version" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_backtest_runs_dataset_from_1" CHECK ("backtest_runs"."dataset_to" > "backtest_runs"."dataset_from"),
	CONSTRAINT "chk_backtest_runs_initial_capital_2" CHECK ("backtest_runs"."initial_capital" > 0),
	CONSTRAINT "chk_backtest_runs_status_3" CHECK ("backtest_runs"."status" in ('queued', 'running', 'completed', 'failed', 'cancelled')),
	CONSTRAINT "chk_backtest_runs_started_at_4" CHECK ("backtest_runs"."finished_at" is null or "backtest_runs"."started_at" is null or "backtest_runs"."finished_at" >= "backtest_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_run_id" uuid NOT NULL,
	"window_id" uuid,
	"instrument_id" uuid NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone,
	"direction" varchar(10) NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"entry_price" numeric(20, 4) NOT NULL,
	"exit_price" numeric(20, 4) NOT NULL,
	"gross_pnl" numeric(20, 2) NOT NULL,
	"costs_total" numeric(20, 2) DEFAULT '0' NOT NULL,
	"net_pnl" numeric(20, 2) NOT NULL,
	"initial_stop" numeric(20, 4),
	"target" numeric(20, 4),
	"r_multiple" numeric(20, 6),
	"exit_reason" varchar(30) NOT NULL,
	"signal_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_backtest_trades_entry_at_1" CHECK ("backtest_trades"."exit_at" is null or "backtest_trades"."exit_at" > "backtest_trades"."entry_at"),
	CONSTRAINT "chk_backtest_trades_direction_2" CHECK ("backtest_trades"."direction" in ('long', 'short')),
	CONSTRAINT "chk_backtest_trades_quantity_3" CHECK ("backtest_trades"."quantity" > 0),
	CONSTRAINT "chk_backtest_trades_entry_price_4" CHECK ("backtest_trades"."entry_price" > 0),
	CONSTRAINT "chk_backtest_trades_exit_price_5" CHECK ("backtest_trades"."exit_price" > 0),
	CONSTRAINT "chk_backtest_trades_initial_stop_6" CHECK ("backtest_trades"."initial_stop" > 0),
	CONSTRAINT "chk_backtest_trades_target_7" CHECK ("backtest_trades"."target" > 0),
	CONSTRAINT "chk_backtest_trades_exit_reason_8" CHECK ("backtest_trades"."exit_reason" in ('target', 'stop', 'eod', 'risk', 'strategy_exit'))
);
--> statement-breakpoint
CREATE TABLE "backtest_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_run_id" uuid NOT NULL,
	"window_index" integer NOT NULL,
	"window_type" varchar(20) NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_backtest_windows_window_index_1" CHECK ("backtest_windows"."window_index" >= 0),
	CONSTRAINT "chk_backtest_windows_window_type_2" CHECK ("backtest_windows"."window_type" in ('development', 'validation', 'holdout', 'walk_forward', 'stress')),
	CONSTRAINT "chk_backtest_windows_from_date_3" CHECK ("backtest_windows"."to_date" > "backtest_windows"."from_date"),
	CONSTRAINT "chk_backtest_windows_status_4" CHECK ("backtest_windows"."status" in ('queued', 'running', 'completed', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "strategy_promotion_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"backtest_run_id" uuid,
	"review_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"thresholds" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategy_promotion_reviews_review_type_1" CHECK ("strategy_promotion_reviews"."review_type" in ('development', 'validation', 'holdout', 'walk_forward', 'stress', 'paper', 'live_pilot')),
	CONSTRAINT "chk_strategy_promotion_reviews_status_2" CHECK ("strategy_promotion_reviews"."status" in ('draft', 'passed', 'failed', 'waived'))
);
--> statement-breakpoint
CREATE TABLE "daily_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"opening_equity" numeric(20, 2),
	"closing_equity" numeric(20, 2),
	"gross_pnl" numeric(20, 2) NOT NULL,
	"costs" numeric(20, 2) NOT NULL,
	"net_pnl" numeric(20, 2) NOT NULL,
	"return_pct" numeric(10, 6),
	"max_drawdown_pct" numeric(10, 6),
	"trades_count" integer DEFAULT 0 NOT NULL,
	"winning_trades" integer DEFAULT 0 NOT NULL,
	"losing_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(10, 6),
	"risk_limit_breaches" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_daily_performance_max_drawdown_pct_1" CHECK ("daily_performance"."max_drawdown_pct" >= 0),
	CONSTRAINT "chk_daily_performance_trades_count_2" CHECK ("daily_performance"."trades_count" >= 0),
	CONSTRAINT "chk_daily_performance_winning_trades_3" CHECK ("daily_performance"."winning_trades" >= 0),
	CONSTRAINT "chk_daily_performance_losing_trades_4" CHECK ("daily_performance"."losing_trades" >= 0),
	CONSTRAINT "chk_daily_performance_win_rate_5" CHECK ("daily_performance"."win_rate" >= 0 and "daily_performance"."win_rate" <= 1),
	CONSTRAINT "chk_daily_performance_risk_limit_breaches_6" CHECK ("daily_performance"."risk_limit_breaches" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" varchar(80) NOT NULL,
	"queue_name" varchar(40) NOT NULL,
	"job_type" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error_message" text,
	"correlation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_job_runs_job_type_1" CHECK ("job_runs"."job_type" in ('ingestion', 'backtest', 'analytics', 'reconciliation', 'square_off', 'report', 'maintenance', 'credential_refresh')),
	CONSTRAINT "chk_job_runs_status_2" CHECK ("job_runs"."status" in ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled')),
	CONSTRAINT "chk_job_runs_started_at_3" CHECK ("job_runs"."finished_at" is null or "job_runs"."started_at" is null or "job_runs"."finished_at" >= "job_runs"."started_at"),
	CONSTRAINT "chk_job_runs_attempt_4" CHECK ("job_runs"."attempt" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"related_entity_type" varchar(80),
	"related_entity_id" uuid,
	"status" varchar(20) NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_notification_events_channel_1" CHECK ("notification_events"."channel" in ('dashboard', 'email', 'webhook', 'log')),
	CONSTRAINT "chk_notification_events_severity_2" CHECK ("notification_events"."severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "chk_notification_events_status_3" CHECK ("notification_events"."status" in ('pending', 'sent', 'failed', 'read'))
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" varchar(30) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"generated_at" timestamp with time zone,
	"file_ref" varchar(240),
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_report_runs_report_type_1" CHECK ("report_runs"."report_type" in ('daily', 'monthly', 'strategy', 'risk', 'reconciliation')),
	CONSTRAINT "chk_report_runs_period_start_2" CHECK ("report_runs"."period_end" >= "report_runs"."period_start"),
	CONSTRAINT "chk_report_runs_status_3" CHECK ("report_runs"."status" in ('queued', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "strategy_performance_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"trading_date" date NOT NULL,
	"gross_pnl" numeric(20, 2) NOT NULL,
	"costs" numeric(20, 2) NOT NULL,
	"net_pnl" numeric(20, 2) NOT NULL,
	"trades_count" integer DEFAULT 0 NOT NULL,
	"winning_trades" integer DEFAULT 0 NOT NULL,
	"losing_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(10, 6),
	"expectancy" numeric(20, 6),
	"profit_factor" numeric(20, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_strategy_performance_daily_trades_count_1" CHECK ("strategy_performance_daily"."trades_count" >= 0),
	CONSTRAINT "chk_strategy_performance_daily_winning_trades_2" CHECK ("strategy_performance_daily"."winning_trades" >= 0),
	CONSTRAINT "chk_strategy_performance_daily_losing_trades_3" CHECK ("strategy_performance_daily"."losing_trades" >= 0),
	CONSTRAINT "chk_strategy_performance_daily_win_rate_4" CHECK ("strategy_performance_daily"."win_rate" >= 0 and "strategy_performance_daily"."win_rate" <= 1),
	CONSTRAINT "chk_strategy_performance_daily_profit_factor_5" CHECK ("strategy_performance_daily"."profit_factor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "system_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"component" varchar(60) NOT NULL,
	"status" varchar(20) NOT NULL,
	"latency_ms" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_system_health_snapshots_component_1" CHECK ("system_health_snapshots"."component" in ('api', 'web', 'worker', 'postgres', 'redis', 'upstox_api', 'market_data_feed')),
	CONSTRAINT "chk_system_health_snapshots_status_2" CHECK ("system_health_snapshots"."status" in ('healthy', 'degraded', 'unhealthy', 'unknown')),
	CONSTRAINT "chk_system_health_snapshots_latency_ms_3" CHECK ("system_health_snapshots"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_data_coverage_instrument_date" ON "market_data_coverage" USING btree ("instrument_id","trading_date");--> statement-breakpoint
CREATE INDEX "idx_market_data_coverage_trading_date" ON "market_data_coverage" USING btree ("trading_date");--> statement-breakpoint
CREATE INDEX "idx_account_instrument_permissions_account_id" ON "account_instrument_permissions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_instrument_permissions_instrument_id" ON "account_instrument_permissions" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_code" ON "accounts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_provider_user" ON "accounts" USING btree ("broker_provider_id","broker_user_ref");--> statement-breakpoint
CREATE INDEX "idx_accounts_is_active" ON "accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor_user_id" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_type" ON "audit_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_id" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_broker_credentials_account_type" ON "broker_credentials" USING btree ("account_id","credential_type");--> statement-breakpoint
CREATE INDEX "idx_broker_credentials_expires_at" ON "broker_credentials" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_domain_events_aggregate_type" ON "domain_events" USING btree ("aggregate_type");--> statement-breakpoint
CREATE INDEX "idx_domain_events_aggregate_id" ON "domain_events" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "idx_domain_events_published_at" ON "domain_events" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_account_access_pair" ON "user_account_access" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_user_account_access_account_id" ON "user_account_access" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_sessions_token_hash" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_corporate_actions_instrument_type_date" ON "corporate_actions" USING btree ("instrument_id","action_type","ex_date");--> statement-breakpoint
CREATE INDEX "idx_corporate_actions_ex_date" ON "corporate_actions" USING btree ("ex_date");--> statement-breakpoint
CREATE INDEX "idx_data_quality_issues_instrument_id" ON "data_quality_issues" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_data_quality_issues_trading_date" ON "data_quality_issues" USING btree ("trading_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exchanges_code" ON "exchanges" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exchanges_mic" ON "exchanges" USING btree ("mic");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instrument_provider_external" ON "instrument_provider_mappings" USING btree ("provider_id","external_key");--> statement-breakpoint
CREATE INDEX "idx_instrument_provider_mappings_instrument_id" ON "instrument_provider_mappings" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instrument_universe_member" ON "instrument_universe_members" USING btree ("universe_version_id","instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instrument_universe_rank" ON "instrument_universe_members" USING btree ("universe_version_id","rank");--> statement-breakpoint
CREATE INDEX "idx_instrument_universe_members_instrument_id" ON "instrument_universe_members" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instrument_universe_versions_number" ON "instrument_universe_versions" USING btree ("universe_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instrument_universes_code" ON "instrument_universes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_instruments_isin" ON "instruments" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_instruments_exchange_id" ON "instruments" USING btree ("exchange_id");--> statement-breakpoint
CREATE INDEX "idx_instruments_trading_symbol" ON "instruments" USING btree ("trading_symbol");--> statement-breakpoint
CREATE INDEX "idx_instruments_is_active" ON "instruments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_market_data_ingestion_runs_provider_id" ON "market_data_ingestion_runs" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_market_data_ingestion_runs_instrument_id" ON "market_data_ingestion_runs" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_providers_code" ON "providers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_raw_provider_payloads_provider_id" ON "raw_provider_payloads" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_raw_provider_payloads_request_fingerprint" ON "raw_provider_payloads" USING btree ("request_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_raw_provider_payloads_expires_at" ON "raw_provider_payloads" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trading_calendar_exchange_date" ON "trading_calendar" USING btree ("exchange_id","trading_date");--> statement-breakpoint
CREATE INDEX "idx_trading_calendar_trading_date" ON "trading_calendar" USING btree ("trading_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_configuration_versions_number" ON "configuration_versions" USING btree ("config_type","scope_key","version");--> statement-breakpoint
CREATE INDEX "idx_configuration_versions_scope_key" ON "configuration_versions" USING btree ("scope_key");--> statement-breakpoint
CREATE INDEX "idx_configuration_versions_payload_hash" ON "configuration_versions" USING btree ("payload_hash");--> statement-breakpoint
CREATE INDEX "idx_risk_events_trading_session_id" ON "risk_events" USING btree ("trading_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_strategies_code" ON "strategies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_strategy_activations_strategy_version_id" ON "strategy_activations" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_activations_account_id" ON "strategy_activations" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_strategy_config_binding" ON "strategy_config_bindings" USING btree ("strategy_version_id","configuration_version_id","role");--> statement-breakpoint
CREATE INDEX "idx_strategy_config_bindings_configuration_version_id" ON "strategy_config_bindings" USING btree ("configuration_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_strategy_universe_member" ON "strategy_universe_members" USING btree ("strategy_version_id","instrument_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_strategy_universe_members_instrument_id" ON "strategy_universe_members" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_strategy_versions_number" ON "strategy_versions" USING btree ("strategy_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trading_sessions_account_date_mode" ON "trading_sessions" USING btree ("account_id","trading_date","mode");--> statement-breakpoint
CREATE INDEX "idx_trading_sessions_trading_date" ON "trading_sessions" USING btree ("trading_date");--> statement-breakpoint
CREATE INDEX "idx_account_equity_snapshots_account_id" ON "account_equity_snapshots" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_equity_snapshots_trading_date" ON "account_equity_snapshots" USING btree ("trading_date");--> statement-breakpoint
CREATE INDEX "idx_broker_position_snapshots_account_id" ON "broker_position_snapshots" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_broker_position_snapshots_captured_at" ON "broker_position_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fills_account_trade" ON "fills" USING btree ("account_id","broker_trade_id");--> statement-breakpoint
CREATE INDEX "idx_fills_order_id" ON "fills" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_fills_instrument_id" ON "fills" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_holdings_snapshots_account_id" ON "holdings_snapshots" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_order_events_sequence" ON "order_events" USING btree ("order_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_order_events_occurred_at" ON "order_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_orders_client_ref" ON "orders" USING btree ("client_order_ref");--> statement-breakpoint
CREATE INDEX "idx_orders_account_id" ON "orders" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_orders_trading_session_id" ON "orders" USING btree ("trading_session_id");--> statement-breakpoint
CREATE INDEX "idx_orders_signal_id" ON "orders" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_orders_instrument_id" ON "orders" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_orders_parent_order_id" ON "orders" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_broker_order_id" ON "orders" USING btree ("broker_order_id");--> statement-breakpoint
CREATE INDEX "idx_position_events_position_id" ON "position_events" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_positions_account_id" ON "positions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_positions_instrument_id" ON "positions" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_positions_trading_session_id" ON "positions" USING btree ("trading_session_id");--> statement-breakpoint
CREATE INDEX "idx_reconciliation_issues_reconciliation_id" ON "reconciliation_issues" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reconciliations_account_date" ON "reconciliations" USING btree ("account_id","trading_date");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_trading_date" ON "reconciliations" USING btree ("trading_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_risk_decisions_signal" ON "risk_decisions" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_risk_decisions_trading_session_id" ON "risk_decisions" USING btree ("trading_session_id");--> statement-breakpoint
CREATE INDEX "idx_round_trip_trades_account_id" ON "round_trip_trades" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_round_trip_trades_strategy_version_id" ON "round_trip_trades" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE INDEX "idx_round_trip_trades_trading_session_id" ON "round_trip_trades" USING btree ("trading_session_id");--> statement-breakpoint
CREATE INDEX "idx_signals_strategy_version_id" ON "signals" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE INDEX "idx_signals_trading_session_id" ON "signals" USING btree ("trading_session_id");--> statement-breakpoint
CREATE INDEX "idx_signals_instrument_id" ON "signals" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_signals_signal_at" ON "signals" USING btree ("signal_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trade_costs_fill" ON "trade_costs" USING btree ("fill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_backtest_equity_point" ON "backtest_equity_curve" USING btree ("backtest_run_id","curve_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_backtest_metrics_key" ON "backtest_metrics" USING btree ("backtest_run_id","metric_key");--> statement-breakpoint
CREATE INDEX "idx_backtest_runs_strategy_version_id" ON "backtest_runs" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_trades_backtest_run_id" ON "backtest_trades" USING btree ("backtest_run_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_trades_instrument_id" ON "backtest_trades" USING btree ("instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_backtest_windows_index" ON "backtest_windows" USING btree ("backtest_run_id","window_index");--> statement-breakpoint
CREATE INDEX "idx_strategy_promotion_reviews_strategy_version_id" ON "strategy_promotion_reviews" USING btree ("strategy_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_performance_account_date" ON "daily_performance" USING btree ("account_id","trading_date");--> statement-breakpoint
CREATE INDEX "idx_daily_performance_trading_date" ON "daily_performance" USING btree ("trading_date");--> statement-breakpoint
CREATE INDEX "idx_job_runs_job_name" ON "job_runs" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "idx_job_runs_scheduled_for" ON "job_runs" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_job_runs_correlation_id" ON "job_runs" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_strategy_performance_day" ON "strategy_performance_daily" USING btree ("strategy_version_id","account_id","trading_date");--> statement-breakpoint
CREATE INDEX "idx_strategy_performance_daily_account_id" ON "strategy_performance_daily" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_performance_daily_trading_date" ON "strategy_performance_daily" USING btree ("trading_date");