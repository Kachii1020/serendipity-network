import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & limitations",
};

export default function TermsPage() {
  return (
    <div className="v3-shell">
      <header className="v3-header">
        <Link className="v3-wordmark" href="/v3" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
      </header>
      <main className="v3-result-main v3-policy">
        <h1>Terms & limitations</h1>
        <p>
          Plans are built from published information. They do not guarantee
          admission, restaurant seating, availability, final order totals, or
          travel time. Check every official site before you go.
        </p>
        <h2>Price estimates</h2>
        <p>
          Budget decisions use published official menu or admission prices.
          Taxes, service charges, transport, optional purchases, and the actual
          food ordered may change the final amount.
        </p>
        <h2>Party size</h2>
        <p>
          Party size is used for cost estimates only. It is not evidence that a
          venue can seat or admit that group at the selected time.
        </p>
      </main>
    </div>
  );
}
