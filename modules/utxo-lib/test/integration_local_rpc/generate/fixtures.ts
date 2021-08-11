/**
 * @prettier
 */
import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';

import { Network } from '../../../src/networkTypes';
import { getNetworkName } from '../../../src/coins';

export function getFixtureDir(network: Network): string {
  const networkName = getNetworkName(network);
  assert(networkName);
  return path.join(__dirname, '..', 'fixtures', networkName);
}

export async function wipeFixtures(network: Network): Promise<void> {
  try {
    await fs.remove(getFixtureDir(network));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return;
    }
  }
}

export async function writeFixture(network: Network, filename: string, content: unknown): Promise<void> {
  await fs.mkdir(getFixtureDir(network), { recursive: true });
  await fs.writeFile(path.join(getFixtureDir(network), filename), JSON.stringify(content, null, 2));
}

export async function readFixture<T>(network: Network, filename: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(getFixtureDir(network), filename), 'utf8'));
}
