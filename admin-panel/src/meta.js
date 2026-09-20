import { createContext, useContext } from "react";

// Hisoblar, toifalar va boshqa umumiy ma'lumotlar (Layout beradi)
export const MetaContext = createContext(null);
export const useMeta = () => useContext(MetaContext);
