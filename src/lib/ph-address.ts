/**
 * Static city/barangay dataset for the Cavite LGUs offered at registration,
 * plus address composition. No network calls — the lists are small (~15 KB)
 * and verified against PSA PSGC / PhilAtlas / LGU sources.
 */

export const CITIES: Record<string, string[]> = {
  "Trece Martires City": [
    "Aguado",
    "Cabezas",
    "Cabuco",
    "Conchu",
    "De Ocampo",
    "Gregorio",
    "Hugo Perez",
    "Inocencio",
    "Lallana",
    "Lapidario",
    "Luciano",
    "Osorio",
    "San Agustin",
  ],
  Tanza: [
    "Amaya 1",
    "Amaya 2",
    "Amaya 3",
    "Amaya 4",
    "Amaya 5",
    "Amaya 6",
    "Amaya 7",
    "Bagtas",
    "Biga",
    "Biwas",
    "Bucal",
    "Bunga",
    "Calibuyo",
    "Capipisa",
    "Daang Amaya 1",
    "Daang Amaya 2",
    "Daang Amaya 3",
    "Halayhay",
    "Julugan 1",
    "Julugan 2",
    "Julugan 3",
    "Julugan 4",
    "Julugan 5",
    "Julugan 6",
    "Julugan 7",
    "Julugan 8",
    "Lambingan",
    "Mulawin",
    "Paradahan 1",
    "Paradahan 2",
    "Poblacion 1",
    "Poblacion 2",
    "Poblacion 3",
    "Poblacion 4",
    "Punta 1",
    "Punta 2",
    "Sahud Ulan",
    "Sanja Mayor",
    "Santol",
    "Tanauan",
    "Tres Cruses",
  ],
  Naic: [
    "Bagong Kalsada",
    "Balsahan",
    "Bancaan",
    "Bucana Malaki",
    "Bucana Sasahan",
    "Calubcob",
    "Capt. C. Nazareno",
    "Gombalza",
    "Halang",
    "Humbac",
    "Ibayo Estacion",
    "Ibayo Silangan",
    "Kanluran Rizal",
    "Labac",
    "Latoria",
    "Mabolo",
    "Malainen Bago",
    "Malainen Luma",
    "Makina",
    "Molino",
    "Munting Mapino",
    "Muzon",
    "Palangue 2 & 3",
    "Palangue Central",
    "Sabang",
    "San Roque",
    "Santulan",
    "Sapa",
    "Timalan Balsahan",
    "Timalan Concepcion",
  ],
  Indang: [
    "Agus-os",
    "Alulod",
    "Banaba Cerca",
    "Banaba Lejos",
    "Bancod",
    "Buna Cerca",
    "Buna Lejos",
    "Buna Lejos II",
    "Calumpang Cerca",
    "Calumpang Lejos",
    "Carasuchi",
    "Daine I",
    "Daine II",
    "Guyam Malaki",
    "Guyam Munti",
    "Harasan",
    "Kayquit I",
    "Kayquit II",
    "Kayquit III",
    "Kaytapos",
    "Kaytambog",
    "Limbon",
    "Lumampong Balagbag",
    "Lumampong Halayhay",
    "Mahabangkahoy Cerca",
    "Mahabangkahoy Lejos",
    "Mataas na Lupa",
    "Poblacion 1",
    "Poblacion 2",
    "Poblacion 3",
    "Poblacion 4",
    "Pulo",
    "Tambo Balagbag",
    "Tambo Ilaya",
    "Tambo Kulit",
    "Tambo Malaki",
  ],
  "General Trias": [
    "1896th",
    "Alingaro",
    "Arnaldo",
    "Bacao I",
    "Bacao II",
    "Bagumbayan",
    "Biclatan",
    "Buenavista I",
    "Buenavista II",
    "Buenavista III",
    "Corregidor",
    "Dulongbayan",
    "Governor Ferrer",
    "Javalera",
    "Manggahan",
    "Navarro",
    "Panungyanan",
    "Pasong Camachile I",
    "Pasong Camachile II",
    "Pasong Kawayan I",
    "Pasong Kawayan II",
    "Pinagtipunan",
    "Prinza",
    "San Francisco",
    "San Gabriel",
    "San Juan I",
    "San Juan II",
    "Sampalucan",
    "Santiago",
    "Santa Clara",
    "Tapia",
    "Tejero",
    "Vibora",
  ],
  "Dasmariñas": [
    "Burol",
    "Burol I",
    "Burol II",
    "Burol III",
    "Datu Esmael",
    "Emmanuel Bergado I",
    "Emmanuel Bergado II",
    "Fatima I",
    "Fatima II",
    "Fatima III",
    "H-2",
    "Langkaan I",
    "Langkaan II",
    "Luzviminda I",
    "Luzviminda II",
    "Paliparan I",
    "Paliparan II",
    "Paliparan III",
    "Sabang",
    "Saint Peter I",
    "Saint Peter II",
    "Salawag",
    "Salitran I",
    "Salitran II",
    "Salitran III",
    "Salitran IV",
    "Sampaloc I",
    "Sampaloc II",
    "Sampaloc III",
    "Sampaloc IV",
    "Sampaloc V",
    "San Agustin I",
    "San Agustin II",
    "San Agustin III",
    "San Andres I",
    "San Andres II",
    "San Antonio de Padua I",
    "San Antonio de Padua II",
    "San Dionisio",
    "San Esteban",
    "San Francisco I",
    "San Francisco II",
    "San Isidro Labrador I",
    "San Isidro Labrador II",
    "San Jose",
    "San Juan",
    "San Lorenzo Ruiz I",
    "San Lorenzo Ruiz II",
    "San Luis I",
    "San Luis II",
    "San Manuel I",
    "San Manuel II",
    "San Mateo",
    "San Miguel",
    "San Miguel II",
    "San Nicolas I",
    "San Nicolas II",
    "San Roque",
    "San Simon",
    "Santa Cristina I",
    "Santa Cristina II",
    "Santa Cruz I",
    "Santa Cruz II",
    "Santa Fe",
    "Santa Lucia",
    "Santa Maria",
    "Santo Cristo",
    "Santo Niño I",
    "Santo Niño II",
    "Victoria Reyes",
    "Zone I",
    "Zone I-B",
    "Zone II",
    "Zone III",
    "Zone IV",
  ],
  Carmona: [
    "Bancal",
    "Barangay 1",
    "Barangay 2",
    "Barangay 3",
    "Barangay 4",
    "Barangay 5",
    "Barangay 6",
    "Barangay 7",
    "Barangay 8",
    "Cabilang Baybay",
    "Lantic",
    "Mabuhay",
    "Maduya",
    "Milagrosa",
  ],
  Tagaytay: [
    "Asisan",
    "Bagong Tubig",
    "Calabuso",
    "Dapdap East",
    "Dapdap West",
    "Francisco",
    "Guinhawa North",
    "Guinhawa South",
    "Iruhin East",
    "Iruhin South",
    "Iruhin West",
    "Kaybagal Central",
    "Kaybagal North",
    "Kaybagal South",
    "Mag-Asawang Ilat",
    "Maharlika East",
    "Maharlika West",
    "Maitim 2nd Central",
    "Maitim 2nd East",
    "Maitim 2nd West",
    "Mendez Crossing East",
    "Mendez Crossing West",
    "Neogan",
    "Patutong Malaki North",
    "Patutong Malaki South",
    "Sambong",
    "San Jose",
    "Silang Junction North",
    "Silang Junction South",
    "Sungay East",
    "Sungay West",
    "Tolentino East",
    "Tolentino West",
    "Zambal",
  ],
};

/** City names in the order the registration form offers them. */
export const CITY_NAMES: string[] = [
  "Trece Martires City",
  "Tanza",
  "Naic",
  "Indang",
  "General Trias",
  "Dasmariñas",
  "Carmona",
  "Tagaytay",
];

/** Barangays for a city; unknown city yields an empty array. */
export function barangaysFor(city: string): string[] {
  return CITIES[city.trim()] ?? [];
}

/**
 * Split a stored address back into parts. Inverse of {@link composeAddress}
 * for composed values; legacy free-text addresses come back whole as the
 * street line with empty city/barangay.
 */
export function parseAddress(composed: string): {
  streetLine: string;
  barangay: string;
  city: string;
} {
  const trimmed = composed.trim();
  if (!trimmed) return { streetLine: "", barangay: "", city: "" };

  const segments = trimmed.split(",").map((segment) => segment.trim());
  let city = "";
  let barangay = "";

  const last = segments[segments.length - 1];
  if (CITY_NAMES.includes(last)) {
    city = segments.pop() ?? "";
  }

  const next = segments[segments.length - 1];
  if (next?.startsWith("Brgy. ")) {
    barangay = (segments.pop() ?? "").slice("Brgy. ".length).trim();
  }

  return { streetLine: segments.join(", ").trim(), barangay, city };
}

/**
 * Compose the free-text address stored in `students.address`:
 * `"123 Mabini St., Brgy. Aguado, Trece Martires City"`.
 * Parts are trimmed; empty parts are skipped.
 */
export function composeAddress(parts: {
  streetLine: string;
  barangay: string;
  city: string;
}): string {
  const streetLine = parts.streetLine.trim();
  const barangay = parts.barangay.trim();
  const city = parts.city.trim();
  const segments: string[] = [];
  if (streetLine) segments.push(streetLine);
  if (barangay) segments.push(`Brgy. ${barangay}`);
  if (city) segments.push(city);
  return segments.join(", ");
}
