# The test data

`BTCUSDT-1m.csv`: 4,000 one-minute bars of BTCUSDT from Binance US, public market data, in the chart app's input
form (`dev/ts/app/chart/README.md`, Its input), its Unix times written as UTC minutes. `request.json`: its scale (the
prices' decimals) and its source. `make chart-package` draws them as a chart of bars alone. `marks.json`: marks on the
last 2,000 of those minutes (a level, two points, a span, a move) in the form the app's `--marks` takes
(`dev/ts/app/chart/src/marks.ts`), their prices the data's. `make chart-check` draws them on those minutes, every
engine; nothing else here is market data. The structure the checks draw is the contract's own vectors (`make
vectors`), bars made up, not of any market, taken from the flake input `contracts`, not kept here.
