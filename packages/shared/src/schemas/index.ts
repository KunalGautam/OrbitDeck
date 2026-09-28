import { z } from 'zod';

export const GroundStationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(-500).max(10000).default(0),
  maidenhead: z
    .string()
    .regex(/^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2}([0-9]{2})?)?$/, 'Invalid Maidenhead grid locator'),
  isDefault: z.boolean().optional(),
  isProtected: z.boolean().optional(),
});

export const CreateGroundStationSchema = GroundStationSchema.omit({ id: true });
export const UpdateGroundStationSchema = CreateGroundStationSchema.partial();

export const SatelliteGroupSchema = z.enum([
  'amateur',
  'weather',
  'stations',
  'gnss',
  'cubesat',
  'military',
  'science',
  'custom',
]);

export const SatelliteFilterSchema = z.object({
  query: z.string().optional(),
  group: SatelliteGroupSchema.optional(),
  favoriteOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(0).max(50000).optional(),
  offset: z.coerce.number().min(0).default(0),
});

export const PassQuerySchema = z.object({
  noradId: z.coerce.number().int().positive(),
  stationId: z.string(),
  daysAhead: z.coerce.number().min(0.1).max(30).default(3),
  minElevationDeg: z.coerce.number().min(0).max(90).default(10),
  stepSeconds: z.coerce.number().min(5).max(120).default(15),
});

export const TimeControlSchema = z.object({
  mode: z.enum(['realtime', 'simulated']),
  isPaused: z.boolean(),
  speedMultiplier: z.number().min(0.1).max(3600),
  timestamp: z.number().int().positive(),
});

export const HamlibConfigSchema = z.object({
  enabled: z.boolean(),
  rigHost: z.string().default('localhost'),
  rigPort: z.number().int().min(1).max(65535).default(4532),
  rotHost: z.string().default('localhost'),
  rotPort: z.number().int().min(1).max(65535).default(4533),
  updateIntervalMs: z.number().int().min(100).max(5000).default(1000),
});
