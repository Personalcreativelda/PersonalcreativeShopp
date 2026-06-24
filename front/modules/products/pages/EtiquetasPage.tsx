import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LabelPrintModal } from '../components/modals/LabelPrintModal';
import { productService } from '../services/productService';
import { Product } from '../../core/types/product';
import { Loader2 } from 'lucide-react';

export const EtiquetasPage: React.FC = () => {
 const navigate = useNavigate();
 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(true);

 const load = () => {
 setLoading(true);
 productService.getProducts().then(data => {
 setProducts(data);
 setLoading(false);
 }).catch(() => setLoading(false));
 };

 useEffect(() => { load(); }, []);

 if (loading) {
 return (
 <div className="flex items-center justify-center h-[calc(100vh-64px)]">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 </div>
 );
 }

 return (
 <LabelPrintModal
 products={products}
 open={true}
 onClose={() => navigate('/admin/produtos')}
 onBarcodeAssigned={load}
 />
 );
};
