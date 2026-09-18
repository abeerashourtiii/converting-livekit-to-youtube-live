// Local, dependency-free replacements for the types react-native-maps used
// to provide. Keeping these here (instead of importing them from a native
// map library) is what lets every screen that only needs the *shape* of a
// region/point — not an actual native map — stay platform-agnostic.

export type LatLng = { lat: number; lng: number };

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
