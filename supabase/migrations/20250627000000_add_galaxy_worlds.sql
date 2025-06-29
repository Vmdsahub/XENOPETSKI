/*
  # Galaxy Worlds Migration

  Migrates galaxy map world positions from localStorage to database for proper persistence
*/

-- Galaxy worlds table for storing world positions and properties
CREATE TABLE IF NOT EXISTS galaxy_worlds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text NOT NULL,
  x_position integer NOT NULL CHECK (x_position >= 0 AND x_position <= 100),
  y_position integer NOT NULL CHECK (y_position >= 0 AND y_position <= 100),
  scale real NOT NULL DEFAULT 1.0 CHECK (scale > 0),
  order_index integer NOT NULL,
  is_active boolean DEFAULT true,
  unlock_requirement jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE galaxy_worlds ENABLE ROW LEVEL SECURITY;

-- Users can read galaxy worlds
CREATE POLICY "Users can read galaxy worlds"
  ON galaxy_worlds FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify galaxy worlds
CREATE POLICY "Admins can modify galaxy worlds"
  ON galaxy_worlds FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert default galaxy worlds
INSERT INTO galaxy_worlds (name, image_url, x_position, y_position, scale, order_index) VALUES
  ('Nexus Prime', 'https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fbd58c52f19d147f09ff36547a19e0305?format=webp&width=1600', 20, 30, 1.0, 1),
  ('Terra Nova', 'https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Fea3ec3d920794634bdf7d66a1159511b?format=webp&width=1600', 70, 20, 1.0, 2),
  ('Crimson Wastes', 'https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F7066e87a53b34231ac837e59befecf75?format=webp&width=1600', 15, 75, 1.0, 3),
  ('Azure Depths', 'https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2F02782c34d2cd4353a884ab021ce35173?format=webp&width=1600', 85, 60, 1.0, 4),
  ('Void Sanctum', 'https://cdn.builder.io/api/v1/image/assets%2F676198b3123e49d5b76d7e142e1266eb%2Facb3e8e8eb33422a88b01594f5d1c470?format=webp&width=1600', 50, 50, 1.0, 5);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_galaxy_worlds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_galaxy_worlds_updated_at
  BEFORE UPDATE ON galaxy_worlds
  FOR EACH ROW
  EXECUTE FUNCTION update_galaxy_worlds_updated_at();
