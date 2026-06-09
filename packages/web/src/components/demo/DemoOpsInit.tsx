import { useEffect } from 'react';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';
import { useAuditStore } from '../../audit/auditStore.js';

/** Hydrates demo ops + audit state once per app session */
export default function DemoOpsInit() {
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const ensureAudit = useAuditStore(s => s.ensureInitialized);
  useEffect(() => {
    ensureInitialized();
    ensureAudit();
  }, [ensureInitialized, ensureAudit]);
  return null;
}
