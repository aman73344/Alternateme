import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';

export enum EventName {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  ALTERNATE_CREATED = 'alternate.created',
  ALTERNATE_UPDATED = 'alternate.updated',
  ALTERNATE_DELETED = 'alternate.deleted',
  TRAINING_STARTED = 'training.started',
  TRAINING_COMPLETED = 'training.completed',
  TRAINING_FAILED = 'training.failed',
  CONVERSATION_STARTED = 'conversation.started',
  CONVERSATION_ENDED = 'conversation.ended',
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  EMAIL_RECEIVED = 'email.received',
  EMAIL_SENT = 'email.sent',
  VOICE_GENERATED = 'voice.generated',
  VOICE_CLONED = 'voice.cloned',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  USAGE_TRACKED = 'usage.tracked',
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  API_KEY_CREATED = 'apikey.created',
  API_KEY_REVOKED = 'apikey.revoked',
  AUDIT_EVENT = 'audit.event',
}

class TypedEventEmitter extends EventEmitter {
  emit(event: EventName, ...args: unknown[]): boolean {
    logger.debug({ event, args: JSON.stringify(args).slice(0, 500) }, 'event emitted');
    return super.emit(event, ...args);
  }

  on(event: EventName, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

export const eventBus = new TypedEventEmitter();
eventBus.setMaxListeners(50);
