import React from "react";
import AppBar from "./Components/LightAppBar/LightAppBar";
import LightTool from "./Components/LightTool";
import CssBaseline from "@material-ui/core/CssBaseline";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import { ThemeProvider } from "styled-components";
import amber from "@material-ui/core/colors/amber";
import deepPurple from "@material-ui/core/colors/deepPurple";

const theme = createMuiTheme({
  palette: {
    type: "dark", // Switching the dark mode on is a single property value change.
    primary: amber,
    secondary: deepPurple
  },
  typography: {
    useNextVariants: true
  }
});

const App = () => (
  <MuiThemeProvider theme={theme}>
    <ThemeProvider theme={{ ...theme }}>
      <CssBaseline>
        <AppBar />
        <LightTool />
      </CssBaseline>
    </ThemeProvider>
  </MuiThemeProvider>
);

export default App;

/*
    React Notes!
    https://camjackson.net/post/9-things-every-reactjs-beginner-should-know#its-just-a-view-library

    1. Keep your components small
     - make your components significantly smaller than you think they need to be

    2. Write functional components
     - const MyComponent = props => ( ...code );
     vs
     - class MyComponent extends React.Component { ...code }

    3. Write stateless components
     - Components should be pure data-in data-out functions of props

    4. Always use propTypes
 */
