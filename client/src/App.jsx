import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Vote from './pages/Vote';
import Admin from './pages/Admin';
import Results from './pages/Results';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/vote" element={<Vote />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/results" element={<Results />} />
    </Routes>
  );
}

export default App;
