import type { FieldValues, UseFormRegister, Path } from 'react-hook-form';
import {
  DEFAULT_ENTITY, DEFAULT_LOCATION, ENTITIES, LOCATIONS, IS_SINGLE_VENUE,
  VENUE_FULL_LABEL, entityForDisplay,
} from '@hub-crm/shared';

type VenueContextFieldsProps<T extends FieldValues> = {
  register: UseFormRegister<T>;
};

/** Entity + location pickers, or a single read-only venue banner for HuB on Lewis. */
export function VenueContextFields<T extends FieldValues & { entity: string; location: string }>({
  register,
}: VenueContextFieldsProps<T>) {
  if (IS_SINGLE_VENUE) {
    return (
      <>
        <input type="hidden" {...register('entity' as Path<T>)} />
        <input type="hidden" {...register('location' as Path<T>)} />
        <div className="form-group full">
          <label className="form-label">Venue</label>
          <div
            className="form-input"
            style={{
              background: 'var(--surface-muted, #f5f5f0)',
              cursor: 'default',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
            aria-readonly
          >
            {VENUE_FULL_LABEL}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label">Entity</label>
        <select {...register('entity' as Path<T>)} className="form-select">
          {ENTITIES.map(e => <option key={e} value={e}>{entityForDisplay(e)}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Location</label>
        <select {...register('location' as Path<T>)} className="form-select">
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </>
  );
}
