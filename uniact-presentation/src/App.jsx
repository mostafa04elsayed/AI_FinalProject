import React, { Suspense } from 'react';
import PresentationContainer from './Presentation/PresentationContainer';

function App() {
  return (
    <Suspense fallback={<div style={{color:'white', background:'#000', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Loading Presentation...</div>}>
      <PresentationContainer />
    </Suspense>
  );
}

export default App;
