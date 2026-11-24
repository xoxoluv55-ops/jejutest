// Where each investigable object of CH1 opens (v0.7 scapula desk/frame, v0.8 the other four bones).
/** investigation kind -> scene key */
export const INV_SCENE: Record<string, string> = {
  desk: 'Investigate', frame: 'Investigate',
  cryolog: 'InvHumerus', cryo: 'InvHumerus',
  bench: 'InvRadius', locker: 'InvRadius',
  toolbox: 'InvUlna', panel: 'InvUlna',
  poster: 'InvClavicle', safe: 'InvClavicle',
  notes: 'InvMuscle', locker2: 'InvMuscle', chart: 'InvMuscle', lightbox: 'InvMuscle', memo: 'InvMuscle', dissect: 'InvMuscle', manual2: 'InvMuscle', rig: 'InvMuscle',
  journal3: 'InvHand', vault3: 'InvHand', surgery: 'InvHand', tunnel: 'InvHand', manual3: 'InvHand', aligner: 'InvHand', poster3: 'InvHand', dial3: 'InvHand',
};
/** an investigable spot the guidance arrow may point at while it still has something to give */
export interface EscSpot { x: number; y: number; todo: () => boolean; store?: boolean }
