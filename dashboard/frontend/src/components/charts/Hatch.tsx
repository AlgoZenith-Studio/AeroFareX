import React from 'react';

/**
 * Rule 6: 45° tone-on-tone hatch for SIMULATED / imputed marks. Render once per
 * SVG; fill a shape with url(#id). The stroke uses currentColor, so the hatch
 * takes the tone of the mark it replaces.
 */
export const HatchDef: React.FC<{ id: string; color?: string; background?: string }> = ({
  id, color = 'currentColor', background,
}) => (
  <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    {background && <rect width="7" height="7" fill={background} />}
    <line x1="0" y1="0" x2="0" y2="7" stroke={color} strokeWidth="2.4" />
  </pattern>
);
