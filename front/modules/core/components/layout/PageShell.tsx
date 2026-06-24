import React from 'react';

export interface PageShellProps {
 title: string;
 description?: string;
 actions?: React.ReactNode;
 children: React.ReactNode;
 /**
 * Se true, aplica padding interno. Por padréo fica false porque o `Layout`
 * jé¡ aplica padding responsivo no `<main>`.
 */
 withInnerPadding?: boolean;
 className?: string;
 compactHeaderMobile?: boolean;
}

export const PageShell: React.FC<PageShellProps> = ({
 title,
 description,
 actions,
 children,
 withInnerPadding = false,
 className = '',
 compactHeaderMobile = false,
}) => {
 const titleClass = compactHeaderMobile
 ? 'text-2xl md:text-3xl font-bold text-content-primary'
 : 'text-3xl font-bold text-content-primary';

 const descriptionClass = compactHeaderMobile
 ? 'text-xs md:text-sm text-content-muted mt-1'
 : 'text-sm text-content-muted mt-1';

 const headerClass = compactHeaderMobile
 ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4'
 : 'flex flex-col md:flex-row md:items-center md:justify-between gap-4';

 return (
 <div className={[withInnerPadding ? 'p-3 md:p-6' : '', 'space-y-6', className].join(' ')}>
 {(title || actions) && (
 <div className={headerClass}>
 {title && (
 <div>
 <h1 className={titleClass}>{title}</h1>
 {description && <p className={descriptionClass}>{description}</p>}
 </div>
 )}
 {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
 </div>
 )}
 {children}
 </div>
 );
};



