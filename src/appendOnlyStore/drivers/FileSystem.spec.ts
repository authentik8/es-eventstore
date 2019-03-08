import fs from 'async-file';
import path from 'path';
import uuid from 'uuid';

import test from 'ava';

import { ConcurrencyError } from '../../errors';
import { IAppendOnlyStore } from '../interfaces';
import { createFileSystemDriver } from './FileSystem';

test.beforeEach((t: any) => {

  const name = t.title.replace(/^[: ]/, '-')

  const testFileName = `EventLog-${name}-${uuid.v4().slice(0, 8)}.log`;
  const TEST_FILE_PATH = path.resolve(
    process.cwd(),
    'test/data',
    testFileName
  );
  t.context.TEST_FILE_PATH = TEST_FILE_PATH;

  t.context.driver = createFileSystemDriver({ filepath: TEST_FILE_PATH });
  t.context.getFileContents = async () => fs.readTextFile(TEST_FILE_PATH, 'utf8');
});

test.afterEach.always(async (t: any) => {
  const filePath = t.context.TEST_FILE_PATH;
  await new Promise(resolve => {
    setTimeout(() => {
      // fs.unlink(filePath)
      t.log(`unlinking path: ${filePath}`)
      resolve()
    }, 50);
  })
});

test('append: ok', async (t: any) => {
  const stream1 = uuid.v4();
  const stream2 = uuid.v4();

  const driver: IAppendOnlyStore = t.context.driver;

  await driver.append(stream1, [{ foo: 'foo', nested: { bar: 1234 } }], 0);
  await driver.append(stream2, [{ baz: 'other' }, { data: 789 }], 0);
  await driver.append(stream1, [{ foo: 'bar' }], 1);

  const fileContents = await t.context.getFileContents();

  const expectedData = `{"streamId":"${stream1}","data":[{"foo":"foo","nested":{"bar":1234}}],"version":1}
{"streamId":"${stream2}","data":[{"baz":"other"},{"data":789}],"version":1}
{"streamId":"${stream1}","data":[{"foo":"bar"}],"version":2}
`;

  t.is(fileContents, expectedData);
});

test('append: concurrency error', async (t: any) => {
  const streamId = 'dummy';

  const driver: IAppendOnlyStore = t.context.driver;

  await driver.append(streamId, [{ foo: 'foo' }], 0);
  const shouldError = async () => driver.append(streamId, [{ foo: 'bar' }], 0);

  await t.throwsAsync(shouldError, {
    instanceOf: ConcurrencyError,
    message: `Expected stream ${streamId} to be 0, got 1`
  });
});

test('readRecords', async (t: any) => {
  const stream1 = uuid.v4();
  
  const driver: IAppendOnlyStore = t.context.driver;
  
  const stream1Payloads: object[][] = [
    [{ added: 1 }, { added: 2 }, { added: 3 }]
  ];
  
  // const stream2 = uuid.v4();
  // const stream2Payloads: object[][] = [
  //   [{ string: 'hello' }, { message: 'world' }]
  // ];

  stream1Payloads.forEach(async (data: object[], version: number ) => {
    await driver.append(stream1, data, version);
  });

  const allRecords = await driver.readAllRecords();

  t.log(allRecords);

  t.is(allRecords.length, 1);
});
