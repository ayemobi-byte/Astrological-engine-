export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

export const ELEMENT_MAP: Record<string, string> = {
  "Aries": "Fire", "Taurus": "Earth", "Gemini": "Wood", "Cancer": "Water",
  "Leo": "Fire", "Virgo": "Earth", "Libra": "Wood", "Scorpio": "Water",
  "Sagittarius": "Fire", "Capricorn": "Metal", "Aquarius": "Wood", "Pisces": "Metal"
};

const SHENG_CYCLE: Record<string, string> = {
  "Wood": "Fire",
  "Fire": "Earth",
  "Earth": "Metal",
  "Metal": "Water",
  "Water": "Wood"
};

const KE_CYCLE: Record<string, string> = {
  "Wood": "Earth",
  "Earth": "Water",
  "Water": "Fire",
  "Fire": "Metal",
  "Metal": "Wood"
};

export function getSignFromDegree(degree: number): string {
  const index = Math.floor((degree % 360) / 30);
  return SIGNS[index];
}

export function getElementFromDegree(degree: number): string {
  return ELEMENT_MAP[getSignFromDegree(degree)];
}

export function calculateGroupBarycenter(matrices: any[], weights: number[]) {
  const compositePlacements: Record<string, any> = {};
  const planets = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

  for (const planet of planets) {
    let xSum = 0.0;
    let ySum = 0.0;
    let totalWeight = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < matrices.length; i++) {
      const degree = matrices[i].placements[planet].degree;
      const rad = degree * (Math.PI / 180);
      xSum += Math.cos(rad) * weights[i];
      ySum += Math.sin(rad) * weights[i];
    }

    const avgRad = Math.atan2(ySum / totalWeight, xSum / totalWeight);
    const avgDegree = (avgRad * (180 / Math.PI) + 360) % 360;

    compositePlacements[planet] = {
      degree: avgDegree,
      sign: getSignFromDegree(avgDegree),
      element: getElementFromDegree(avgDegree)
    };
  }

  return { placements: compositePlacements };
}

// Simple seeded random generator for deterministic charts
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function generateDeepChart(dob: string, name: string, hour: number = 12, minute: number = 0) {
  const rand = seededRandom(dob + name + hour + minute);
  const placements: Record<string, any> = {};
  const planets = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

  for (const planet of planets) {
    const degree = (rand() / 4294967296) * 360;
    placements[planet] = {
      degree,
      sign: getSignFromDegree(degree),
      element: getElementFromDegree(degree)
    };
  }

  return { name, dob, hour, minute, placements };
}

export function generateEphemeris(clockVectorT: string) {
  // Generate a transit chart based on current time
  const date = new Date(clockVectorT);
  return generateDeepChart(clockVectorT, "Transit", date.getHours(), date.getMinutes());
}

export function evaluateElementalAspect(p1Sign: string, p2Sign: string, aspectType: string) {
  const e1 = ELEMENT_MAP[p1Sign];
  const e2 = ELEMENT_MAP[p2Sign];

  if (aspectType === "Trine" || aspectType === "Sextile") {
    const isSheng = SHENG_CYCLE[e1] === e2 || SHENG_CYCLE[e2] === e1;
    const direction = SHENG_CYCLE[e1] === e2 ? 'forward' : 'reverse';
    return { 
      cycle: "Generative (Sheng)", 
      vibe: isSheng ? `${e1} nourishes ${e2}` : `${e1} and ${e2} harmonize`,
      type: 'generative',
      elements: [e1, e2],
      direction: isSheng ? direction : 'none'
    };
  } else if (aspectType === "Square" || aspectType === "Opposition") {
    const isKe = KE_CYCLE[e1] === e2 || KE_CYCLE[e2] === e1;
    const direction = KE_CYCLE[e1] === e2 ? 'forward' : 'reverse';
    return { 
      cycle: "Overcoming (Ke)", 
      vibe: isKe ? `${e1} dominates/shapes ${e2}` : `${e1} and ${e2} conflict`,
      type: 'overcoming',
      elements: [e1, e2],
      direction: isKe ? direction : 'none'
    };
  } else if (aspectType === "Conjunction") {
    return { 
      cycle: "Amalgamation", 
      vibe: `${e1} and ${e2} fuse into an alloy`,
      type: 'amalgamation',
      elements: [e1, e2]
    };
  }
  return { cycle: "Neutral", vibe: `${e1} and ${e2} coexist`, type: 'neutral', elements: [e1, e2] };
}

export function calculateAspectType(deg1: number, deg2: number): string {
  let diff = Math.abs(deg1 - deg2);
  if (diff > 180) diff = 360 - diff;

  const orb = 8; // 8 degrees orb
  if (diff <= orb) return "Conjunction";
  if (Math.abs(diff - 60) <= orb) return "Sextile";
  if (Math.abs(diff - 90) <= orb) return "Square";
  if (Math.abs(diff - 120) <= orb) return "Trine";
  if (Math.abs(diff - 180) <= orb) return "Opposition";

  return "None";
}

export function getCoordinates(degree: number, radius: number, centerX: number, centerY: number) {
  const rad = (degree - 90) * (Math.PI / 180);
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad)
  };
}

export function calculateInterMatrix(matrixA: any, matrixB: any) {
  const aspects: any[] = [];
  const planets = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

  for (const p1 of planets) {
    for (const p2 of planets) {
      const deg1 = matrixA.placements[p1].degree;
      const deg2 = matrixB.placements[p2].degree;
      const aspectType = calculateAspectType(deg1, deg2);

      if (aspectType !== "None") {
        const elemental = evaluateElementalAspect(
          matrixA.placements[p1].sign,
          matrixB.placements[p2].sign,
          aspectType
        );
        aspects.push({
          p1: `${matrixA.name}'s ${p1}`,
          p2: `${matrixB.name}'s ${p2}`,
          aspectType,
          ...elemental
        });
      }
    }
  }
  return aspects;
}
