import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./composables/useCornerStyle";
import { installGlobalScrollbarVisibility } from "./composables/useGlobalScrollbarVisibility";
import "./composables/useTheme";
import { installContextMenu } from "./composables/useContextMenu";
import { vContextMenu } from "./directives/contextMenu";
import "./styles.css";

installContextMenu();
installGlobalScrollbarVisibility();

const app = createApp(App);
app.use(router);
app.directive("context-menu", vContextMenu);
app.mount("#root");
