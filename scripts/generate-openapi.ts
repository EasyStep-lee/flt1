import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

import { createDeterministicOpenApiDocument } from '../apps/api/src/openapi/openapi-document.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultOpenApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi.json');
const defaultTypesPath = path.join(repoRoot, 'packages', 'contracts', 'types.ts');

const parseOutputPath = (flag: string, fallback: string): string => {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a path`);
  }
  return path.resolve(repoRoot, value);
};

const writeGeneratedContracts = async (): Promise<void> => {
  const openApiPath = parseOutputPath('--openapi-output', defaultOpenApiPath);
  const typesPath = parseOutputPath('--types-output', defaultTypesPath);
  const document = await createDeterministicOpenApiDocument();
  const typeAst = await openapiTS(
    document as Parameters<typeof openapiTS>[0],
  );
  const typeSource = astToString(typeAst).replace(/\r\n?/gu, '\n').trimEnd();
  const openApiSource = `${JSON.stringify(document, null, 2)}\n`;

  await Promise.all([
    mkdir(path.dirname(openApiPath), { recursive: true }),
    mkdir(path.dirname(typesPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(openApiPath, openApiSource, 'utf8'),
    writeFile(typesPath, `${typeSource}\n`, 'utf8'),
  ]);
  process.stdout.write(
    `Generated deterministic OpenAPI contract: ${path.relative(repoRoot, openApiPath)}\n` +
      `Generated shared TypeScript contract: ${path.relative(repoRoot, typesPath)}\n`,
  );
};

await writeGeneratedContracts();
