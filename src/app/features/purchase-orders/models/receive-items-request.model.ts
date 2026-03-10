import { ReceiveLineRequest } from './receive-line-request.model';

export interface ReceiveItemsRequest {
  lines: ReceiveLineRequest[];
}
