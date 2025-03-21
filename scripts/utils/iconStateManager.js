export const IconStates = {
  DEFAULT: 'default',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  LOADING: 'loading'
};

export const IconSizes = {
  SMALL: 16,
  MEDIUM: 48,
  LARGE: 128
};

export const IconColors = {
  DEFAULT: '#000000',
  ACTIVE: '#1DA1F2',
  DISABLED: '#657786',
  HOVER: 'rgba(29, 161, 242, 0.1)'
};

export function getIconPath(state, size) {
  const baseDir = state === IconStates.DEFAULT ? '' : `${state}/`;
  const suffix = state === IconStates.DEFAULT ? '' : `-${state}`;
  return `icons/${baseDir}icon${size}${suffix}.png`;
} 