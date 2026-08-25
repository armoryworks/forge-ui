import { TestBed } from '@angular/core/testing';

import { MobileInstance } from '../models/mobile-instance.model';
import { InstanceService } from './instance.service';

const make = (host: string, shared = false): MobileInstance => ({
  id: InstanceService.idFor(`https://${host}`),
  serverUrl: `https://${host}`,
  name: host,
  certSha256: null,
  deviceUuid: 'u1',
  deviceId: 1,
  deviceName: 'Phone',
  shared,
});

describe('InstanceService', () => {
  let service: InstanceService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstanceService);
    await service.init();
  });

  afterEach(() => localStorage.clear());

  it('keeps credentials namespaced per instance and switches the active one', async () => {
    await service.setInstance(make('a.example.com'), 'refresh-a');
    await service.setInstance(make('b.example.com'), 'refresh-b');

    expect(service.instances().length).toBe(2);
    expect(service.instance()?.serverUrl).toBe('https://b.example.com');
    expect(await service.getRefreshToken()).toBe('refresh-b');

    await service.activate(InstanceService.idFor('https://a.example.com'));
    expect(service.instance()?.serverUrl).toBe('https://a.example.com');
    expect(await service.getRefreshToken()).toBe('refresh-a');
  });

  it('removing an instance drops its credentials and falls back to another', async () => {
    await service.setInstance(make('a.example.com'), 'refresh-a');
    await service.setSharedInstance(make('c.example.com', true), 'device-c');
    expect(service.getDeviceToken()).toBe('device-c');

    await service.wipe();

    expect(service.instances().map((i) => i.serverUrl)).toEqual(['https://a.example.com']);
    expect(service.instance()?.serverUrl).toBe('https://a.example.com');
    expect(service.getDeviceToken()).toBeNull();
    expect(localStorage.getItem('forge-mobile-device-token:c.example.com')).toBeNull();
  });

  it('migrates a legacy single-instance record', async () => {
    localStorage.setItem('forge-mobile-instance', JSON.stringify({ ...make('old.example.com'), id: undefined }));
    localStorage.setItem('forge-mobile-refresh', 'refresh-old');

    const fresh = TestBed.inject(InstanceService);
    await fresh.init();

    expect(fresh.instance()?.serverUrl).toBe('https://old.example.com');
    expect(await fresh.getRefreshToken()).toBe('refresh-old');
    expect(localStorage.getItem('forge-mobile-instance')).toBeNull();
  });
});
