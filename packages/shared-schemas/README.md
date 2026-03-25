# Shared Schemas

This package will hold shared contracts used by:

- the extension
- the control plane
- future admin console clients
- tests and contract validation

The package currently includes:

- schema versioning constants
- TypeScript interfaces
- JSON Schema starter files
- runtime validators that can now be reused by the extension and control plane
- package-local tests for the active and scaffolded shared contracts
- TypeScript-backed package-local typechecking through `tsc --noEmit`

This package should now be treated as the authoritative place to evolve shared runtime contracts from the architecture docs.

Useful local commands:

- `npm run build --workspace @cleanprompt/shared-schemas`
- `npm run lint --workspace @cleanprompt/shared-schemas`
- `npm run test --workspace @cleanprompt/shared-schemas`
- `npm run typecheck --workspace @cleanprompt/shared-schemas`
