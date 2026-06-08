import { registerRootComponent } from 'expo';

// Background location task — registerRootComponent'ten önce tanımlanmalı
import "./src/lib/locationTask";

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
