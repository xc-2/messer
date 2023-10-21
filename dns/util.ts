import { evalCommand, runCommand } from "../common/deps.ts";

interface IDomainRecord {
  DomainName: string;
  Locked: boolean;
  Priority: number;
  RR: string;
  RecordId: string;
  Status: string;
  TTL: number;
  Type: string;
  Value: string;
}

export async function getDNSRecords(tld: string, rr: string) {
  const { stdout } = await evalCommand("aliyun", {
    args: [
      "aliyun",
      "alidns",
      "DescribeDomainRecords",
      "--DomainName",
      tld,
    ],
  });
  const result = JSON.parse(stdout) as {
    DomainRecords: {
      Record: IDomainRecord[];
    };
  };
  const records = result.DomainRecords.Record.filter(({ RR }) => RR === rr);
  return records;
}

export async function updateDNSRecord(
  record: IDomainRecord,
  values: Partial<IDomainRecord>,
) {
  let changed = false;
  Object.entries(values).forEach(([key, value]) => {
    const oldValue = record[key as keyof IDomainRecord];
    if (value == null || value === oldValue) return;
    (record as Record<keyof IDomainRecord, IDomainRecord[keyof IDomainRecord]>)[
      key as keyof IDomainRecord
    ] = value;
    changed = true;
  });
  if (!changed) return false;
  await runCommand("aliyun", {
    args: [
      "alidns",
      "UpdateDomainRecord",
      "--RecordId",
      record.RecordId,
      "--RR",
      record.RR,
      "--Type",
      record.Type,
      "--Value",
      record.Value,
    ],
  });
  return true;
}
