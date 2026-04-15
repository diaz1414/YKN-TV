import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ChannelDetail from './pages/ChannelDetail';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/:id" element={<ChannelDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
