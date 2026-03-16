import { createContext, useContext } from 'react'

export type VoiceSettingsContextValue = {
  openVoiceSettings: () => void
}

export const VoiceSettingsContext = createContext<VoiceSettingsContextValue | null>(null)

export function useVoiceSettings() {
  return useContext(VoiceSettingsContext)
}
