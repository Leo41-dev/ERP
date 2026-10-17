import { startTransition, type FormEvent } from "react";

/**
 * React 19, `action` ile gönderilen formu işlem bitince sıfırlar; doğrulama hatasında
 * kullanıcının yazdıkları kaybolmasın diye form bu yardımcıyla gönderilir.
 */
export function sifirlamadan(eylem: (f: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(() => eylem(f));
  };
}
