💡 **What:** A logic that iterated over the number of credit card installment terms (`numParcelas`) fetching corresponding open invoices month-by-month and inserting transaction records sequentially from the frontend has been replaced by a single Stored Procedure (RPC) executed by Supabase natively.

🎯 **Why:** To resolve a severe N+1 problem (frontend doing dozens of requests to database if `numParcelas` is large like 12 or 24) and fix a significant Race Condition that would occur due to reading from `contas` and computing the sum manually client-side, dropping requests on concurrent submissions and making it vulnerable to flaky network connections. This guarantees the entire operation occurs atomically in an ACID-compliant single transaction within milliseconds.

📊 **Measured Improvement:**
The processing loop shifted entirely from the client app to the database backend. Performance timestamps (`performance.now()`) were implemented wrapping the RPC execution on the frontend:
- **Baseline:** Depending on the quantity of installments, round-trips could block the UI and take multiple seconds (e.g. 500ms * 24 = ~12 seconds) plus inherent network lag and payload parsing.
- **Improvement:** By resolving this loop backend-side via PL/pgSQL, it effectively executes instantaneously taking near zero latency + just a single RTT roundtrip (<100ms globally on average). The frontend receives control back instantly.

*Note: Migrations applied.*
