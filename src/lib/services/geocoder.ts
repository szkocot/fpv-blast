// src/lib/services/geocoder.ts
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    const data = await res.json();
    const city    = data.city || data.locality || '';
    const country = data.countryName || '';
    return [city, country].filter(Boolean).join(', ') || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  } catch {
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }
}

export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
}

export async function forwardGeocode(query: string): Promise<GeoResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: { display_name: string; lat: string; lon: string }) => ({
      name: r.display_name.split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}
