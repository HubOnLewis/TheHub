# Perfect Venue XLSX imports

Place these exports here (or in repo `import/`):

- Event export `.xlsx` (sheet: **Data**)
- Proposal export `.xlsx` (sheet: **Data**)
- Contact export `.xlsx` (sheet: **Data**)

Then run:

```bash
npm run import:perfect-venue
```

Outputs:

- `packages/web/src/data/perfectVenueFullExport.ts` (sanitized frontend seed — commit after review)
- `data/perfect-venue-processed/*.json` (local debug only, gitignored)

Raw XLSX files are gitignored.
