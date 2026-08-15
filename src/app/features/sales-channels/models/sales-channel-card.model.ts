import { SalesChannel } from './sales-channel.model';

/**
 * A channel plus the presentation choices derived from it, computed once in the
 * component rather than called per row from the template — template binding to a
 * method re-invokes it on every change-detection pass.
 */
export interface SalesChannelCard {
  channel: SalesChannel;
  typeLabelKey: string;
  typeChipClass: string;
  /** Set-default is offered only for an active, non-default account channel. */
  canMakeDefault: boolean;
  /** The default channel is the fallback for every order without an explicit one, so it cannot be removed. */
  canDelete: boolean;
  /** Only a retail channel with a connector attached has anything to poll. */
  canImport: boolean;
}
