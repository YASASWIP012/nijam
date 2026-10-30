import { sha256 } from "./report";

const SPEAKING_MS = 20_000;
/** Room to release the Flow key and for the text to arrive. */
const GRACE_MS = 10_000;

const secret = () => process.env.RECEIPT_KEY ?? "";
const sign = (claimId: string, startedAt: number) => sha256(`${claimId}:${startedAt}:${secret()}`);

export async function startClock(claimId: string, now = Date.now()) {
  return { startedAt: now, token: await sign(claimId, now) };
}

/** True when this clock was issued here and the answer arrived inside twenty seconds plus grace. */
export async function withinClock(claimId: string, startedAt: number, token: string, now = Date.now()): Promise<boolean> {
  return token === (await sign(claimId, startedAt)) && now - startedAt <= SPEAKING_MS + GRACE_MS;
}
