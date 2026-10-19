import { uygulamaAdi } from "@/lib/belgeAyarlari";
import { GirisFormu } from "./GirisFormu";

export const dynamic = "force-dynamic";

export default async function GirisSayfasi() {
  return <GirisFormu ad={await uygulamaAdi()} />;
}
