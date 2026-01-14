-- Add telegram_message_id column to purchases table to track Telegram messages
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS telegram_message_id bigint;

-- Add telegram_chat_id column to store which chat the message was sent to
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;