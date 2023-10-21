import { cac } from "https://esm.sh/cac@6.7.14/mod.ts";
import { getDNSRecords, updateDNSRecord } from "./util.ts";

const dns = cac("dns");
dns.help();

dns
  .command("get <tld> [rr]", "show current DNS binding")
  .action(async (tld: string, rr: string) => {
    rr ||= "@";
    const records = await getDNSRecords(tld, rr);
    const result = records.reduce((res, item) => {
      res[item.Type] = item.Value;
      return res;
    }, {} as Record<string, unknown>);
    console.log(JSON.stringify(result));
  });

dns
  .command("bind <tld> [rr]", "bind current IP to DNS record")
  .option("-p, --public", "use public IP")
  .option("--ipv4 <ipv4>", "set IPv4")
  .option("--ipv6 <ipv6>", "set IPv6")
  // .option('-v, --value <value>', 'the value to be resolved as, default as IP of this device')
  .action(async (tld: string, rr: string, options: any) => {
    rr ||= "@";
    const records = await getDNSRecords(tld, rr || "@");
    for (
      const [ip, type] of [
        [options.ipv4, "A"],
        [options.ipv6, "AAAA"],
      ]
    ) {
      try {
        if (!ip) {
          console.warn(`${type} not supported`);
          continue;
        }
        const record = records.find((item) => item.Type === type);
        if (!record) {
          console.warn(
            `${rr}.${tld} [type=${type}] is not found`,
          );
          continue;
        }
        if (
          await updateDNSRecord(record, {
            Type: type,
            Value: ip,
          })
        ) {
          console.log(
            `${rr}.${tld} [type=${type}] is resolved to ${ip}`,
          );
        } else {
          console.log(
            `${rr}.${tld} is already resolved to ${ip}`,
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

dns.parse();
